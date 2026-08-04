"use client";

import { useTransition } from "react";
import { getExportCsvs } from "./actions";

const UTF8_BOM = "﻿";

function download(filename: string, content: string) {
  const blob = new Blob([UTF8_BOM + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function ExportButtons() {
  const [isPending, startTransition] = useTransition();

  const exportAll = () => {
    startTransition(async () => {
      const { ingredientsCsv, purchasesCsv, recipesCsv, sopStepsCsv } = await getExportCsvs();
      const date = new Date().toISOString().slice(0, 10);
      if (ingredientsCsv) download(`ingredients-${date}.csv`, ingredientsCsv);
      if (purchasesCsv) download(`purchases-${date}.csv`, purchasesCsv);
      if (recipesCsv) download(`recipes-${date}.csv`, recipesCsv);
      if (sopStepsCsv) download(`sop-steps-${date}.csv`, sopStepsCsv);
    });
  };

  return (
    <div className="space-y-3 card">
      <p className="text-sm text-text-secondary">
        Download your ingredients, purchases, recipes, and SOP steps as CSV files — a manual
        backup of your own data.
      </p>
      <button
        onClick={exportAll}
        disabled={isPending}
        className="w-full btn-primary"
      >
        {isPending ? "Preparing…" : "Download CSV export"}
      </button>
    </div>
  );
}
