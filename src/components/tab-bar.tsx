"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Five destinations max (Android/iOS guidance for a bottom bar), each with an
// icon + label so it can be hit one-handed without reading. Recipes lives
// under "Make" with Batches — set up once, used when making a batch.
const TABS = [
  { href: "/dashboard", label: "Home", icon: "home", match: ["/dashboard"] },
  { href: "/sales", label: "Sell", icon: "sell", match: ["/sales"] },
  { href: "/batches", label: "Make", icon: "make", match: ["/batches", "/recipes"] },
  { href: "/stock", label: "Stock", icon: "stock", match: ["/stock"] },
  {
    href: "/more",
    label: "More",
    icon: "more",
    match: ["/more", "/financials", "/analytics", "/export", "/closing", "/settings", "/print-station"],
  },
] as const;

type IconName = (typeof TABS)[number]["icon"];

function TabIcon({ name }: { name: IconName }) {
  const common = {
    width: 24,
    height: 24,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (name) {
    case "home":
      return (
        <svg {...common}>
          <path d="M3 10.5 12 3l9 7.5" />
          <path d="M5 9.5V21h14V9.5" />
          <path d="M10 21v-6h4v6" />
        </svg>
      );
    case "sell":
      return (
        <svg {...common}>
          <path d="M4 5h2l2.2 10.2a1 1 0 0 0 1 .8h8.6a1 1 0 0 0 1-.8L20 8H7" />
          <circle cx="10" cy="20" r="1.3" />
          <circle cx="17" cy="20" r="1.3" />
        </svg>
      );
    case "make":
      return (
        <svg {...common}>
          <path d="M4 10h16" />
          <path d="M5 10v7a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3v-7" />
          <path d="M9 6c0-1 1-1.5 1-2.5M13 6c0-1 1-1.5 1-2.5" />
        </svg>
      );
    case "stock":
      return (
        <svg {...common}>
          <path d="M3 7.5 12 3l9 4.5-9 4.5z" />
          <path d="M3 7.5V16.5L12 21l9-4.5V7.5" />
          <path d="M12 12v9" />
        </svg>
      );
    case "more":
      return (
        <svg {...common}>
          <circle cx="5" cy="12" r="1.4" />
          <circle cx="12" cy="12" r="1.4" />
          <circle cx="19" cy="12" r="1.4" />
        </svg>
      );
  }
}

export function TabBar() {
  const pathname = usePathname() ?? "";

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-bg/95 backdrop-blur">
      <div
        className="mx-auto grid max-w-2xl pb-[env(safe-area-inset-bottom)]"
        style={{ gridTemplateColumns: `repeat(${TABS.length}, minmax(0, 1fr))` }}
      >
        {TABS.map((tab) => {
          const active = tab.match.some((r) => pathname.startsWith(r));
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-14 flex-col items-center justify-center gap-0.5 py-1.5 text-center text-xs font-medium transition-colors ${
                active ? "text-accent" : "text-text-secondary"
              }`}
            >
              <TabIcon name={tab.icon} />
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
