"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Batches and Recipes share the "Make" tab; this segmented control switches
// between them without another bottom-bar slot.
const SEGMENTS = [
  { href: "/batches", label: "Batches" },
  { href: "/recipes", label: "Recipes" },
] as const;

export function MakeSwitcher() {
  const pathname = usePathname() ?? "";

  return (
    <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl border border-border bg-surface p-1">
      {SEGMENTS.map((s) => {
        const active = pathname.startsWith(s.href);
        return (
          <Link
            key={s.href}
            href={s.href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-11 items-center justify-center rounded-lg text-sm font-medium ${
              active ? "bg-bg text-accent" : "text-text-secondary"
            }`}
          >
            {s.label}
          </Link>
        );
      })}
    </div>
  );
}
