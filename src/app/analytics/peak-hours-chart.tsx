"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { PeakHour } from "@/lib/data/analytics";

const GRID_BORDER = "#2c2c2e";
const TEXT_SECONDARY = "#98989d";
const ACCENT = "#00e5ff";

function HourTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: number;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow-lg">
      <p className="text-text-secondary">{String(label).padStart(2, "0")}:00</p>
      <p className="font-mono font-semibold text-text">{payload[0].value} sales</p>
    </div>
  );
}

export function PeakHoursChart({ data }: { data: PeakHour[] }) {
  const hasData = data.some((d) => d.count > 0);

  if (!hasData) {
    return (
      <p className="flex h-48 items-center justify-center text-sm text-text-secondary">
        No sales logged yet.
      </p>
    );
  }

  return (
    <div className="h-48 w-full" role="img" aria-label="Sales count by hour of day">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <XAxis
            dataKey="hour"
            tick={{ fill: TEXT_SECONDARY, fontSize: 10 }}
            axisLine={{ stroke: GRID_BORDER }}
            tickLine={false}
            interval={2}
            tickFormatter={(v: number) => String(v).padStart(2, "0")}
          />
          <YAxis
            tick={{ fill: TEXT_SECONDARY, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={30}
            allowDecimals={false}
          />
          <Tooltip cursor={{ fill: GRID_BORDER, opacity: 0.4 }} content={<HourTooltip />} />
          <Bar dataKey="count" fill={ACCENT} radius={[4, 4, 0, 0]} maxBarSize={16} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
