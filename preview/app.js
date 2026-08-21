// Ordexa offline preview — shared core: nav, modal, toast, storage, costing.
// Not the real app. No backend, no auth, no RLS. Just for clicking through UI
// ideas before building them for real in the Next.js app.

const STORAGE_KEY = "ordexa_preview_v1";

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function money(n) {
  return "฿" + (Number(n) || 0).toFixed(2);
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// ---- Navigation ----
function nav(sectionName) {
  document.querySelectorAll(".section").forEach((el) => el.classList.remove("active"));
  document.querySelectorAll(".nav-btn").forEach((el) => el.classList.remove("active"));

  const section = document.getElementById("section-" + sectionName);
  const btn = document.querySelector(`.nav-btn[data-section="${sectionName}"]`);
  if (section) section.classList.add("active");
  if (btn) btn.classList.add("active");

  const renderer = window["render_" + sectionName];
  if (typeof renderer === "function") renderer();
}

// ---- Modal ----
function openModal(title, bodyHtml, onMount) {
  document.getElementById("modal-title").textContent = title;
  document.getElementById("modal-body").innerHTML = bodyHtml;
  document.getElementById("modal-overlay").classList.add("open");
  if (typeof onMount === "function") onMount();
}

function closeModal() {
  document.getElementById("modal-overlay").classList.remove("open");
  document.getElementById("modal-body").innerHTML = "";
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeModal();
});

// ---- Toast ----
let toastTimer = null;
function showToast(message, isError) {
  const el = document.getElementById("toast");
  el.textContent = message;
  el.classList.toggle("error", !!isError);
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2400);
}

// ---- Storage (all app data lives here; global arrays are views onto it) ----
let ingredients = [];
let recipes = [];
let batches = [];
let finishedGoods = [];
let sales = [];
let expenses = [];
let stockAdjustments = [];

function saveAll() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ ingredients, recipes, batches, finishedGoods, sales, expenses, stockAdjustments })
  );
}

function loadAll() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    seedData();
    saveAll();
    return;
  }
  try {
    const data = JSON.parse(raw);
    ingredients = data.ingredients || [];
    recipes = data.recipes || [];
    batches = data.batches || [];
    finishedGoods = data.finishedGoods || [];
    sales = data.sales || [];
    expenses = data.expenses || [];
    stockAdjustments = data.stockAdjustments || [];
  } catch {
    seedData();
    saveAll();
  }
}

function resetDemoData() {
  if (!confirm("Reset to demo data? This clears everything you've clicked through.")) return;
  seedData();
  saveAll();
  showToast("Demo data reset");
  const active = document.querySelector(".section.active");
  if (active) {
    const name = active.id.replace("section-", "");
    const renderer = window["render_" + name];
    if (typeof renderer === "function") renderer();
  }
}

function seedData() {
  ingredients = [
    { id: "ing-chili", name: "Dried chili", unit: "g", qty_on_hand: 4200, avg_price_per_unit: 0.42, low_stock_threshold: 500 },
    { id: "ing-garlic", name: "Garlic", unit: "g", qty_on_hand: 1800, avg_price_per_unit: 0.18, low_stock_threshold: 300 },
    { id: "ing-fish-sauce", name: "Fish sauce", unit: "ml", qty_on_hand: 6000, avg_price_per_unit: 0.09, low_stock_threshold: 1000 },
    { id: "ing-sugar", name: "Palm sugar", unit: "g", qty_on_hand: 250, avg_price_per_unit: 0.15, low_stock_threshold: 500 },
    { id: "ing-bottle", name: "Glass bottle 250ml", unit: "pcs", qty_on_hand: 120, avg_price_per_unit: 6.5, low_stock_threshold: 30 },
  ];

  recipes = [
    {
      id: "rec-nam-prik",
      name: "Nam Prik Chili Sauce",
      bottle_size_ml: 250,
      batch_volume_ml: 5000,
      target_sell_price: 89,
      platform_fee_pct: 5.42,
      vat_pct: 0,
      labor_hours_per_batch: 2,
      labor_rate_per_hour: 60,
      overhead_per_batch: 40,
      waste_pct: 5,
      evaporation_loss_pct: 8,
      ingredients: [
        { ingredient_id: "ing-chili", qty_used: 800 },
        { ingredient_id: "ing-garlic", qty_used: 300 },
        { ingredient_id: "ing-fish-sauce", qty_used: 500 },
        { ingredient_id: "ing-sugar", qty_used: 200 },
      ],
      packaging: [{ item_name: "Bottle + cap + label", cost_per_unit: 8 }],
    },
    {
      id: "rec-noodle-sauce",
      name: "Cold Noodle Dressing",
      bottle_size_ml: 200,
      batch_volume_ml: 4000,
      target_sell_price: 65,
      platform_fee_pct: 0,
      vat_pct: 0,
      labor_hours_per_batch: 1.5,
      labor_rate_per_hour: 60,
      overhead_per_batch: 30,
      waste_pct: 3,
      evaporation_loss_pct: 2,
      ingredients: [
        { ingredient_id: "ing-fish-sauce", qty_used: 600 },
        { ingredient_id: "ing-sugar", qty_used: 400 },
        { ingredient_id: "ing-garlic", qty_used: 100 },
      ],
      packaging: [{ item_name: "Bottle + cap + label", cost_per_unit: 7 }],
    },
  ];

  batches = [
    { id: "b1", recipe_id: "rec-nam-prik", batch_date: todayISO(), actual_yield_bottles: 17, notes: "" },
  ];

  finishedGoods = [{ recipe_id: "rec-nam-prik", qty_on_hand: 12, low_stock_threshold: 5 }];

  sales = [
    { id: "s1", recipe_id: "rec-nam-prik", qty_bottles: 5, price_charged_total: 445, platform: "tiktok", payment_status: "paid", sale_date: todayISO(), customer_ref: "", notes: "" },
  ];

  expenses = [{ id: "e1", category: "Packaging", amount: 480, expense_date: todayISO(), notes: "Bottle restock" }];

  stockAdjustments = [];
}

// ---- Costing (mirrors src/lib/costing.ts calcRecipeCost) ----
function calcRecipeCost(recipe) {
  const effectiveVolumeMl =
    recipe.batch_volume_ml * (1 - recipe.evaporation_loss_pct / 100) * (1 - recipe.waste_pct / 100);
  const bottlesPerBatchRaw = recipe.bottle_size_ml > 0 ? effectiveVolumeMl / recipe.bottle_size_ml : 0;
  const bottlesPerBatch = Math.floor(bottlesPerBatchRaw);

  const rawMaterialCostPerBatch = (recipe.ingredients || []).reduce((sum, ri) => {
    const ing = ingredients.find((i) => i.id === ri.ingredient_id);
    return sum + ri.qty_used * (ing ? ing.avg_price_per_unit : 0);
  }, 0);
  const packagingCostPerBottle = (recipe.packaging || []).reduce((sum, p) => sum + p.cost_per_unit, 0);
  const laborCostPerBatch = recipe.labor_hours_per_batch * recipe.labor_rate_per_hour;

  const divisor = bottlesPerBatch > 0 ? bottlesPerBatch : 1;
  const rawMaterialCostPerBottle = rawMaterialCostPerBatch / divisor;
  const laborCostPerBottle = laborCostPerBatch / divisor;
  const overheadCostPerBottle = recipe.overhead_per_batch / divisor;

  const costPerBottle =
    rawMaterialCostPerBottle + packagingCostPerBottle + laborCostPerBottle + overheadCostPerBottle;

  const sellPrice = recipe.target_sell_price || 0;
  const platformFeeAmount = sellPrice * (recipe.platform_fee_pct / 100);
  const vatAmount = sellPrice * ((recipe.vat_pct || 0) / 100);
  const profitPerBottle = sellPrice - platformFeeAmount - vatAmount - costPerBottle;
  const marginPct = sellPrice > 0 ? (profitPerBottle / sellPrice) * 100 : 0;

  let indicator = "alert";
  if (bottlesPerBatch > 0 && sellPrice > 0) {
    if (marginPct >= 25) indicator = "success";
    else if (marginPct >= 10) indicator = "warning";
    else indicator = "alert";
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

// ---- Boot ----
window.addEventListener("DOMContentLoaded", () => {
  loadAll();
  nav("dashboard");
});
