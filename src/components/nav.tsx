"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/stock/actions";

const TABS = [
  { href: "/stock", label: "Stock" },
  { href: "/stock/low", label: "Low stock" },
  { href: "/recipes", label: "Recipes" },
  { href: "/batches", label: "Batches" },
  { href: "/export", label: "Export" },
] as const;

export function Nav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-bg/95 backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
        <span className="text-lg font-semibold tracking-tight text-text">Sauce Tracker</span>
        <form action={signOut}>
          <button className="text-xs text-text-secondary underline underline-offset-2">
            Sign out
          </button>
        </form>
      </div>
      <nav className="mx-auto flex max-w-2xl gap-1 overflow-x-auto px-4 pb-2">
        {TABS.map((tab) => {
          const active =
            tab.href === "/stock"
              ? pathname === "/stock"
              : pathname?.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`shrink-0 rounded-lg px-3 py-2 text-center text-sm font-medium transition-colors ${
                active
                  ? "bg-accent text-[#121212]"
                  : "bg-surface text-text-secondary hover:bg-surface-hover"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
