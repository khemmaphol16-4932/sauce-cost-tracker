export type YieldVarianceRow = {
  recipeId: string;
  recipeName: string;
  estimatedBottles: number;
  avgActualBottles: number;
  batchCount: number;
  variancePct: number;
};

const ALERT_THRESHOLD_PCT = -15;

function varianceStyle(pct: number): string {
  if (pct <= -10) return "text-alert";
  if (pct < 0) return "text-amber-400";
  return "text-success";
}

export function YieldVarianceCard({ rows }: { rows: YieldVarianceRow[] }) {
  const alerts = rows.filter((r) => r.variancePct <= ALERT_THRESHOLD_PCT);

  return (
    <div className="card">
      <h2 className="mb-1 text-sm font-semibold text-text">Yield variance</h2>
      <p className="mb-3 text-xs text-text-secondary">
        Average actual bottles logged per batch vs. the recipe&apos;s estimate.
      </p>
      {alerts.length > 0 && (
        <div className="mb-3 rounded-xl border border-alert/40 bg-alert-bg px-4 py-3 text-sm text-alert">
          <p className="font-semibold">
            {alerts.length} recipe{alerts.length === 1 ? "" : "s"} running {Math.abs(ALERT_THRESHOLD_PCT)}%+
            under estimate
          </p>
          <p className="mt-1 text-xs opacity-90">
            {alerts.map((r) => r.recipeName).join(", ")} — worth checking waste, evaporation loss,
            or measurement error.
          </p>
        </div>
      )}
      <ul className="divide-y divide-border">
        {rows.map((r) => (
          <li key={r.recipeId} className="flex items-center justify-between py-2 text-sm">
            <div className="min-w-0 flex-1">
              <p className="truncate text-text">{r.recipeName}</p>
              <p className="text-xs text-text-secondary">
                {r.avgActualBottles.toFixed(1)} avg actual vs. {r.estimatedBottles} estimated (
                {r.batchCount} batch{r.batchCount === 1 ? "" : "es"})
              </p>
            </div>
            <span className={`shrink-0 pl-2 font-mono text-sm font-semibold ${varianceStyle(r.variancePct)}`}>
              {r.variancePct > 0 ? "+" : ""}
              {r.variancePct.toFixed(0)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
