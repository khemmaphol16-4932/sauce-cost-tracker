import Link from "next/link";
import { signOut } from "@/app/stock/actions";

const LINKS = [
  {
    href: "/settings",
    label: "Shop & label",
    description: "Logo, contact info and thank-you message printed on each bag",
  },
  {
    href: "/print-station",
    label: "Print station",
    description: "Open on the shop computer to print bag labels automatically",
  },
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
        <Link key={item.href} href={item.href} className="card flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-base font-semibold text-text">{item.label}</p>
            <p className="mt-0.5 text-sm text-text-secondary">{item.description}</p>
          </div>
          <span className="shrink-0 text-text-secondary" aria-hidden>
            ›
          </span>
        </Link>
      ))}

      {/* Moved here from the header so it can't be hit by accident mid-sale. */}
      <form action={signOut} className="pt-4">
        <button className="w-full btn-danger">Sign out</button>
      </form>
    </div>
  );
}
