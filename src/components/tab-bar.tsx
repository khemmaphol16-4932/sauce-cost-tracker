"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/stock", label: "Stock" },
  { href: "/stock/low", label: "Low stock" },
  { href: "/recipes", label: "Recipes" },
  { href: "/batches", label: "Batches" },
  { href: "/export", label: "Export" },
] as const;

export function TabBar() {
  const pathname = usePathname();

  return (
    <nav className="mx-auto flex max-w-2xl gap-1 overflow-x-auto px-4 pb-2">
      {TABS.map((tab) => {
        const active =
          tab.href === "/stock" ? pathname === "/stock" : pathname?.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`shrink-0 rounded-lg px-3 py-2 text-center text-sm font-medium ${
              active ? "bg-accent text-[#121212]" : "bg-surface text-text-secondary hover:bg-surface-hover"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
