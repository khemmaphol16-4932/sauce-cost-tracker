import Link from "next/link";
import { signOut } from "@/app/stock/actions";

export function Nav({ active }: { active: "stock" | "low" }) {
  return (
    <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
        <span className="text-sm font-semibold text-neutral-900">Sauce Tracker</span>
        <form action={signOut}>
          <button className="text-xs text-neutral-500 underline underline-offset-2">
            Sign out
          </button>
        </form>
      </div>
      <nav className="mx-auto flex max-w-2xl gap-1 px-4 pb-2">
        <Link
          href="/stock"
          className={`flex-1 rounded-lg py-2 text-center text-sm font-medium ${
            active === "stock"
              ? "bg-neutral-900 text-white"
              : "bg-neutral-100 text-neutral-600"
          }`}
        >
          Stock
        </Link>
        <Link
          href="/stock/low"
          className={`flex-1 rounded-lg py-2 text-center text-sm font-medium ${
            active === "low"
              ? "bg-neutral-900 text-white"
              : "bg-neutral-100 text-neutral-600"
          }`}
        >
          Low stock
        </Link>
      </nav>
    </header>
  );
}
