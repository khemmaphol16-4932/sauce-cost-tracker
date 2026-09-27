// Placeholder shown the instant a tab is tapped, while the page's data loads.
// Each route's loading.tsx renders inside that route's layout, so the title
// and tab bar stay put and only the content area pulses.
export function PageLoading({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-20 animate-pulse rounded-2xl border border-border bg-surface" />
      ))}
    </div>
  );
}
