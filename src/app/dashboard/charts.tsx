"use client";

import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MonthlySpend, RecipeMargin, RealMarginMonth } from "@/lib/data/dashboard";

const GRID_BORDER = "#2c2c2e";
const TEXT_SECONDARY = "#98989d";
const ACCENT = "#00e5ff";
const SUCCESS = "#16a34a";

const INDICATOR_COLOR: Record<RecipeMargin["indicator"], string> = {
  red: "#ff453a",
  yellow: "#d97706",
  green: "#16a34a",
};

function ChartTooltip({
  active,
  payload,
  label,
  formatValue,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
  formatValue: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow-lg">
      <p className="text-text-secondary">{label}</p>
      <p className="font-mono font-semibold text-text">{formatValue(payload[0].value)}</p>
    </div>
  );
}

export function MonthlySpendChart({ data }: { data: MonthlySpend[] }) {
  const hasData = data.some((d) => d.total > 0);

  if (!hasData) {
    return (
      <p className="flex h-48 items-center justify-center text-sm text-text-secondary">
        No purchases logged in the last 6 months.
      </p>
    );
  }

  return (
    <div className="h-48 w-full" role="img" aria-label="Monthly ingredient spend, last 6 months">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <XAxis
            dataKey="month"
            tick={{ fill: TEXT_SECONDARY, fontSize: 11 }}
            axisLine={{ stroke: GRID_BORDER }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: TEXT_SECONDARY, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={40}
            tickFormatter={(v: number) => `฿${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
          />
          <Tooltip
            cursor={{ fill: GRID_BORDER, opacity: 0.4 }}
            content={<ChartTooltip formatValue={(v) => `฿${v.toFixed(2)}`} />}
          />
          <Bar dataKey="total" fill={ACCENT} radius={[4, 4, 0, 0]} maxBarSize={36} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function RealMarginChart({ data }: { data: RealMarginMonth[] }) {
  const hasData = data.some((d) => d.marginPct != null);

  if (!hasData) {
    return (
      <p className="flex h-48 items-center justify-center text-sm text-text-secondary">
        No sales logged in the last 6 months.
      </p>
    );
  }

  const chartData = data.map((d) => ({ month: d.month, marginPct: d.marginPct ?? 0 }));

  return (
    <div className="h-48 w-full" role="img" aria-label="Real profit margin percentage, last 6 months">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <XAxis
            dataKey="month"
            tick={{ fill: TEXT_SECONDARY, fontSize: 11 }}
            axisLine={{ stroke: GRID_BORDER }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: TEXT_SECONDARY, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={40}
            tickFormatter={(v: number) => `${v}%`}
          />
          <Tooltip
            cursor={{ fill: GRID_BORDER, opacity: 0.4 }}
            content={<ChartTooltip formatValue={(v) => `${v.toFixed(0)}% margin`} />}
          />
          <Bar dataKey="marginPct" fill={SUCCESS} radius={[4, 4, 0, 0]} maxBarSize={36} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function RecipeMarginChart({ data }: { data: RecipeMargin[] }) {
  if (data.length === 0) {
    return (
      <p className="flex h-48 items-center justify-center text-sm text-text-secondary">
        Set a target sell price on a recipe to see its margin here.
      </p>
    );
  }

  return (
    <div
      className="w-full"
      style={{ height: Math.max(160, data.length * 40) }}
      role="img"
      aria-label="Profit margin percentage by recipe"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 8, right: 24, left: 0, bottom: 0 }}
        >
          <XAxis
            type="number"
            tick={{ fill: TEXT_SECONDARY, fontSize: 11 }}
            axisLine={{ stroke: GRID_BORDER }}
            tickLine={false}
            tickFormatter={(v: number) => `${v}%`}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fill: TEXT_SECONDARY, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={100}
          />
          <Tooltip
            cursor={{ fill: GRID_BORDER, opacity: 0.4 }}
            content={<ChartTooltip formatValue={(v) => `${v.toFixed(0)}% margin`} />}
          />
          <Bar dataKey="marginPct" radius={[0, 4, 4, 0]} maxBarSize={20}>
            {data.map((entry) => (
              <Cell key={entry.id} fill={INDICATOR_COLOR[entry.indicator]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
