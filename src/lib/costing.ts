export type RecipeCostInputs = {
  batch_volume_ml: number;
  evaporation_loss_pct: number;
  waste_pct: number;
  bottle_size_ml: number;
  labor_hours_per_batch: number;
  labor_rate_per_hour: number;
  overhead_per_batch: number;
  platform_fee_pct: number;
  vat_pct: number;
  target_sell_price: number | null;
};

export type CostedIngredient = {
  qty_used: number;
  avg_price_per_unit: number;
};

export type CostedPackagingItem = {
  cost_per_unit: number;
};

export function calcRecipeCost(
  recipe: RecipeCostInputs,
  ingredients: CostedIngredient[],
  packaging: CostedPackagingItem[]
) {
  const effectiveVolumeMl =
    recipe.batch_volume_ml *
    (1 - recipe.evaporation_loss_pct / 100) *
    (1 - recipe.waste_pct / 100);

  const bottlesPerBatchRaw =
    recipe.bottle_size_ml > 0 ? effectiveVolumeMl / recipe.bottle_size_ml : 0;
  const bottlesPerBatch = Math.floor(bottlesPerBatchRaw);

  const rawMaterialCostPerBatch = ingredients.reduce(
    (sum, i) => sum + i.qty_used * i.avg_price_per_unit,
    0
  );
  const packagingCostPerBottle = packaging.reduce((sum, p) => sum + p.cost_per_unit, 0);
  const laborCostPerBatch = recipe.labor_hours_per_batch * recipe.labor_rate_per_hour;

  const divisor = bottlesPerBatch > 0 ? bottlesPerBatch : 1;
  const rawMaterialCostPerBottle = rawMaterialCostPerBatch / divisor;
  const laborCostPerBottle = laborCostPerBatch / divisor;
  const overheadCostPerBottle = recipe.overhead_per_batch / divisor;

  const costPerBottle =
    rawMaterialCostPerBottle + packagingCostPerBottle + laborCostPerBottle + overheadCostPerBottle;

  const sellPrice = recipe.target_sell_price ?? 0;
  const platformFeeAmount = sellPrice * (recipe.platform_fee_pct / 100);
  const vatAmount = sellPrice * (recipe.vat_pct / 100);
  const profitPerBottle = sellPrice - platformFeeAmount - vatAmount - costPerBottle;
  const marginPct = sellPrice > 0 ? (profitPerBottle / sellPrice) * 100 : 0;

  let indicator: "red" | "yellow" | "green" = "red";
  if (bottlesPerBatch > 0 && sellPrice > 0) {
    if (marginPct >= 25) indicator = "green";
    else if (marginPct >= 10) indicator = "yellow";
    else indicator = "red";
  }

  return {
    bottlesPerBatch,
    bottlesPerBatchRaw,
    rawMaterialCostPerBottle,
    packagingCostPerBottle,
    laborCostPerBottle,
    overheadCostPerBottle,
    costPerBottle,
    platformFeeAmount,
    vatAmount,
    profitPerBottle,
    marginPct,
    indicator,
  };
}

export const PLATFORM_FEE_PRESETS = [
  { label: "Self-sell (0%)", value: 0 },
  { label: "TikTok Shop (~5%)", value: 5 },
  { label: "Shopee (~5.42%)", value: 5.42 },
  { label: "Lazada (~6.3%)", value: 6.3 },
] as const;
