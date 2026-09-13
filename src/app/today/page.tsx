import { PageShell } from "@/components/page-shell";
import { createClient } from "@/lib/supabase/server";
import { getCurrentBusinessId } from "@/lib/data/businesses";
import { getRecipes } from "@/lib/data/recipes";
import type { DeliveryOrder } from "@/lib/orders";
import { TodayBoard } from "./today-board";

export default async function TodayPage() {
  const db = await createClient();
  const business = await getCurrentBusinessId();
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const [recipes, result] = await Promise.all([
    getRecipes(), db.from("delivery_orders").select("id,channel,reference,items,notes,status,due_at,created_at,booked_at")
      .eq("business_id", business)
      .or(`status.in.(new,cooking,ready),and(status.eq.delivered,booked_at.is.null),created_at.gte.${day}T00:00:00+07:00`)
      .order("due_at", { ascending: true }),
  ]);
  return <PageShell title="วันนี้" subtitle="รับออเดอร์ ทำอาหาร และส่งของจากหน้าเดียว">
    {result.error ? <div className="card space-y-2" role="alert"><p>ยังโหลดคิวออเดอร์ไม่ได้</p><p className="text-sm text-text-secondary">หากเพิ่งติดตั้ง ให้ผู้ดูแลติดตั้งฐานข้อมูลออเดอร์ก่อน แล้วรีเฟรชหน้านี้ ระบบเดิมยังเข้าใช้งานได้จากเมนูด้านล่าง</p></div>
      : <TodayBoard key={business} recipes={recipes} initialOrders={(result.data ?? []) as DeliveryOrder[]} />}
  </PageShell>;
}
