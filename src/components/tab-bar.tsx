"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/stock", label: "Stock" },
  { href: "/recipes", label: "Recipes" },
  { href: "/batches", label: "Batches" },
  { href: "/sales", label: "Sales" },
  { href: "/export", label: "Export" },
] as const;

export function TabBar() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-bg/95 backdrop-blur">
      <div
        className="mx-auto grid max-w-2xl pb-[env(safe-area-inset-bottom)]"
        style={{ gridTemplateColumns: `repeat(${TABS.length}, minmax(0, 1fr))` }}
      >
        {TABS.map((tab) => {
          const active =
            tab.href === "/stock" ? pathname === "/stock" : pathname?.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center justify-center py-2.5 text-center text-[11px] font-medium transition-colors ${
                active ? "text-accent" : "text-text-secondary"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
