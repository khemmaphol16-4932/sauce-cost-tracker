"use client";

import { useState } from "react";
import {
  CostTrendChart,
  MonthlySpendChart,
  RealMarginChart,
  RecipeMarginChart,
  TopIngredientsChart,
} from "./charts";
import type {
  CostTrendPoint,
  IngredientSpend,
  MonthlySpend,
  RecipeMargin,
  RealMarginMonth,
} from "@/lib/data/dashboard";

const TABS = ["Real margin", "Spend", "Top ingredients", "Target margin", "Cost trend"] as const;
type Tab = (typeof TABS)[number];

const SUBTITLES: Record<Tab, string> = {
  "Real margin": "From actual sales, last 6 months",
  Spend: "Ingredient spend / month, last 6 months",
  "Top ingredients": "Top ingredients by spend, all-time",
  "Target margin": "Estimated margin by recipe, where a target price is set",
  "Cost trend": "Cost per bottle, last 20 batches",
};

export function ChartTabs({
  realMarginTrend,
  monthlySpend,
  topIngredientsBySpend,
  recipeMargins,
  costTrend,
}: {
  realMarginTrend: RealMarginMonth[];
  monthlySpend: MonthlySpend[];
  topIngredientsBySpend: IngredientSpend[];
  recipeMargins: RecipeMargin[];
  costTrend: CostTrendPoint[];
}) {
  const [tab, setTab] = useState<Tab>("Real margin");

  return (
    <div className="card">
      <div className="mb-3 flex gap-1 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
              tab === t
                ? "bg-accent text-[#121212]"
                : "bg-bg text-text-secondary hover:bg-surface-hover"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      <p className="mb-2 text-xs text-text-secondary">{SUBTITLES[tab]}</p>

      {tab === "Real margin" && <RealMarginChart data={realMarginTrend} />}
      {tab === "Spend" && <MonthlySpendChart data={monthlySpend} />}
      {tab === "Top ingredients" && <TopIngredientsChart data={topIngredientsBySpend} />}
      {tab === "Target margin" && <RecipeMarginChart data={recipeMargins} />}
      {tab === "Cost trend" && <CostTrendChart data={costTrend} />}
    </div>
  );
}
