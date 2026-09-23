import { BusinessSwitcher } from "./business-switcher";
import { TabBar } from "./tab-bar";

export function Nav() {
  return (
    <>
      <header className="sticky top-0 z-10 border-b border-border bg-bg/95 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-2 px-4 py-2">
          <span className="shrink-0 text-base font-semibold tracking-tight text-text-secondary">
            Ordexa
          </span>
          <BusinessSwitcher />
        </div>
      </header>

      <TabBar />
    </>
  );
}
