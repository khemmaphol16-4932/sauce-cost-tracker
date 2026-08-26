import Link from "next/link";

const LINKS = [
  {
    href: "/closing",
    label: "Daily closing",
    description: "Count the drawer, compare to expected cash",
  },
  {
    href: "/financials",
    label: "Financials",
    description: "Ingredient buying list, expenses, revenue/spend/profit overview",
  },
  {
    href: "/analytics",
    label: "Analytics",
    description: "Repeat customers, peak hours, waste logging",
  },
  {
    href: "/export",
    label: "Export",
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
