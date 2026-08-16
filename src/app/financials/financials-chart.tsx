"use client";

import { Bar, BarChart, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { FinancialsMonth } from "@/lib/data/financials";

const TEXT_SECONDARY = "#98989d";
const SUCCESS = "#16a34a";
const ACCENT = "#00e5ff";
const ALERT = "#ff453a";

function fmtBaht(v: number) {
  return `฿${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v.toFixed(0)}`;
}

export function FinancialsChart({ data }: { data: FinancialsMonth[] }) {
  const hasData = data.some((d) => d.revenue > 0 || d.ingredientSpend > 0 || d.expenses > 0);

  if (!hasData) {
    return (
      <p className="flex h-56 items-center justify-center text-sm text-text-secondary">
        No revenue, purchases, or expenses logged in the last 6 months.
      </p>
    );
  }

  return (
    <div className="h-56 w-full" role="img" aria-label="Revenue vs ingredient spend vs expenses, last 6 months">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <XAxis
            dataKey="month"
            tick={{ fill: TEXT_SECONDARY, fontSize: 11 }}
            axisLine={{ stroke: "#2c2c2e" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: TEXT_SECONDARY, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={40}
            tickFormatter={fmtBaht}
          />
          <Tooltip
            cursor={{ fill: "#2c2c2e", opacity: 0.4 }}
            contentStyle={{
              background: "var(--color-surface, #1c1c1e)",
              border: "1px solid #2c2c2e",
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(value) => fmtBaht(Number(value))}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: TEXT_SECONDARY }} />
          <Bar dataKey="revenue" name="Revenue" fill={SUCCESS} radius={[4, 4, 0, 0]} maxBarSize={16} />
          <Bar dataKey="ingredientSpend" name="Ingredients" fill={ACCENT} radius={[4, 4, 0, 0]} maxBarSize={16} />
          <Bar dataKey="expenses" name="Expenses" fill={ALERT} radius={[4, 4, 0, 0]} maxBarSize={16} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
