export const channels = { self: "สั่งตรง", grab: "Grab", lineman: "LINE MAN", other: "อื่น ๆ" } as const;
export const stages = { new: "รอทำ", cooking: "กำลังทำ", ready: "รอไรเดอร์", delivered: "ส่งแล้ว", cancelled: "ยกเลิก" } as const;
export type Stage = keyof typeof stages;
export type OrderItem = { recipe_id: string; name: string; qty: number; price: number; note: string };
export type DeliveryOrder = {
  id: string; channel: keyof typeof channels; reference: string; items: OrderItem[];
  notes: string; status: Stage; due_at: string; created_at: string; booked_at: string | null;
};
export const total = (items: OrderItem[]) => items.reduce((sum, item) => sum + Math.round(item.price * 100) * item.qty, 0) / 100;
export const baht = (value: number) => new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB" }).format(value);
export function validItems(value: unknown): value is OrderItem[] {
  return Array.isArray(value) && value.length > 0 && value.length <= 50 && value.every(item =>
    item && typeof item.recipe_id === "string" && /^[0-9a-f-]{36}$/i.test(item.recipe_id) &&
    Number.isInteger(item.qty) && item.qty > 0 && item.qty <= 999 &&
    Number.isFinite(item.price) && item.price >= 0 && item.price <= 100000 &&
    typeof item.note === "string" && item.note.length <= 300);
}
export function canTransition(from: Stage, to: Stage) {
  return (from === "new" && (to === "cooking" || to === "cancelled")) ||
    (from === "cooking" && to === "ready") || (from === "ready" && to === "delivered");
}
