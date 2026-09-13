"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentBusinessId } from "@/lib/data/businesses";
import { getRecipeDetail, getRecipes } from "@/lib/data/recipes";
import { calcRecipeCost } from "@/lib/costing";
import { channels, validItems, canTransition, type Stage, type OrderItem } from "@/lib/orders";
import { revalidatePath } from "next/cache";

async function context() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) throw new Error("กรุณาเข้าสู่ระบบอีกครั้ง");
  return { db, user, business: await getCurrentBusinessId() };
}
const message = (e: unknown) => e instanceof Error ? e.message : "บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง";

export async function addOrder(input: { id: string; channel: string; reference: string; items: OrderItem[]; notes: string; minutes: number }) {
  try {
    if (!/^[0-9a-f-]{36}$/i.test(input.id) || !Object.hasOwn(channels, input.channel) ||
      !validItems(input.items) || typeof input.reference !== "string" || input.reference.length > 80 ||
      typeof input.notes !== "string" || input.notes.length > 500 ||
      !Number.isInteger(input.minutes) || input.minutes < 1 || input.minutes > 240) throw new Error("กรุณาตรวจสอบรายการและเวลาที่ต้องส่ง");
    const { db, user, business } = await context();
    const recipes = await getRecipes();
    const items = input.items.map(item => {
      const recipe = recipes.find(r => r.id === item.recipe_id);
      if (!recipe) throw new Error("ไม่พบเมนูนี้ในร้าน กรุณารีเฟรช");
      return { ...item, name: recipe.name, price: Math.round(item.price * 100) / 100 };
    });
    const { error } = await db.from("delivery_orders").insert({ id: input.id, user_id: user.id,
      business_id: business, channel: input.channel, reference: input.reference.trim(), items,
      notes: input.notes.trim(), due_at: new Date(Date.now() + input.minutes * 60000).toISOString() });
    if (error) {
      if (error.code === "23505") {
        const { data } = await db.from("delivery_orders").select("id").eq("id", input.id).eq("business_id", business).maybeSingle();
        if (!data) throw new Error("เลขออเดอร์นี้มีแล้วในช่องทางนี้ กรุณาตรวจรายการเดิม");
      } else throw new Error(error.message);
    }
    revalidatePath("/today");
    return { ok: true };
  } catch (e) { return { error: message(e) }; }
}

export async function moveOrder(id: string, from: Stage, to: Stage) {
  try {
    if (!canTransition(from, to)) throw new Error("ไม่สามารถเปลี่ยนสถานะนี้ได้");
    const { db, business } = await context();
    const { error } = await db.rpc("advance_delivery_order", { p_id: id, p_business: business, p_from: from, p_to: to });
    if (error) throw new Error("สถานะอาจเปลี่ยนจากอีกเครื่อง กรุณารีเฟรชแล้วลองใหม่");
    revalidatePath("/today");
    return { ok: true };
  } catch (e) { return { error: message(e) }; }
}

export async function bookOrder(id: string, fee: number) {
  try {
    if (!Number.isFinite(fee) || fee < 0 || fee > 100) throw new Error("กรอกค่าธรรมเนียม 0–100%");
    const { db, business } = await context();
    const { data, error: readError } = await db.from("delivery_orders").select("items").eq("id", id).eq("business_id", business).single();
    if (readError || !data) throw new Error("ไม่พบออเดอร์");
    const costs: Record<string, number> = {};
    for (const item of data.items as OrderItem[]) {
      const detail = await getRecipeDetail(item.recipe_id);
      if (!detail) throw new Error("ไม่พบสูตรสำหรับคำนวณต้นทุน");
      costs[item.recipe_id] = calcRecipeCost(detail.recipe, detail.ingredients, detail.packaging).costPerBottle;
    }
    const { error } = await db.rpc("book_delivery_order", { p_id: id, p_business: business, p_costs: costs, p_fee: fee });
    if (error) throw new Error(`ยังลงยอดขายไม่ได้ กรุณาตรวจสต็อกและสูตรในระบบเดิม: ${error.message}`);
    for (const path of ["/today", "/sales", "/stock", "/financials", "/dashboard", "/closing"]) revalidatePath(path);
    return { ok: true };
  } catch (e) { return { error: message(e) }; }
}
