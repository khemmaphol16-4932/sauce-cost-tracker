import Link from "next/link";

const LINKS = [
  { href: "/sales", label: "ประวัติยอดขาย / รับเงิน", description: "ตรวจรายการขายและเปลี่ยนสถานะการรับเงิน" },
  { href: "/batches", label: "เตรียมของ / ผลิตเป็นรอบ", description: "บันทึกการเตรียมอาหารและสินค้าพร้อมขาย" },
  { href: "/dashboard", label: "ภาพรวมร้าน", description: "ดูตัวเลขและกราฟจากระบบเดิม" },
  {
    href: "/closing",
    label: "ปิดยอดประจำวัน",
    description: "Count the drawer, compare to expected cash",
  },
  {
    href: "/financials",
    label: "การเงิน",
    description: "Ingredient buying list, expenses, revenue/spend/profit overview",
  },
  {
    href: "/analytics",
    label: "วิเคราะห์ร้าน / ของเสีย",
    description: "Repeat customers, peak hours, waste logging",
  },
  {
    href: "/export",
    label: "ส่งออกข้อมูล",
    description: "Download your data as CSV files",
  },
] as const;

export default function MorePage() {
  return (
    <div className="space-y-3">
      {LINKS.map((item) => (
        <Link key={item.href} href={item.href} className="card block">
          <p className="text-sm font-semibold text-text">{item.label}</p>
          <p className="mt-0.5 text-xs text-text-secondary">{item.description}</p>
        </Link>
      ))}
    </div>
  );
}
