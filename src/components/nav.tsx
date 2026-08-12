import { signOut } from "@/app/stock/actions";
import { BusinessSwitcher } from "./business-switcher";
import { TabBar } from "./tab-bar";

export function Nav() {
  return (
    <>
      <header className="sticky top-0 z-10 border-b border-border bg-bg/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-2 px-4 py-3">
          <span className="shrink-0 text-lg font-semibold tracking-tight text-text">
            Ordexa
          </span>
          <div className="flex items-center gap-3">
            <BusinessSwitcher />
            <form action={signOut}>
              <button className="text-xs text-text-secondary underline underline-offset-2">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <TabBar />
    </>
  );
}
