function render_batches() {
  const el = document.getElementById("section-batches");
  const recipeOptions = recipes.map((r) => `<option value="${r.id}">${r.name}</option>`).join("");

  el.innerHTML = `
    ${makeSwitcher("batches")}
    <div class="section-header"><div><h1>Batches</h1><p>Log production, credits bottle stock</p></div></div>

    <div class="card">
      <p class="card-title">Log a batch</p>
      ${recipes.length === 0 ? '<p class="empty-state">Create a recipe first.</p>' : `
        <div class="field"><label>Recipe</label><select id="f-recipe">${recipeOptions}</select></div>
        <div class="field-row" style="margin-top:8px">
          <div class="field"><label>Bottle yield (blank = estimate)</label><input id="f-yield" type="number" min="0" placeholder="auto"></div>
          <div class="field"><label>Date</label><input id="f-date" type="date" value="${todayISO()}"></div>
        </div>
        <button class="btn btn-primary" style="margin-top:10px" onclick="submitLogBatch()">Log batch</button>
      `}
    </div>

    <div class="card">
      <p class="card-title">Batch history</p>
      <ul class="row-list">
        ${batches.length === 0 ? '<li class="empty-state">No batches logged yet.</li>' :
          [...batches].reverse().map((b) => {
            const r = recipes.find((r) => r.id === b.recipe_id);
            return `
              <li class="row-item">
                <div><div class="main-text">${r ? r.name : "(deleted)"}</div><div class="sub-text">${b.batch_date}</div></div>
                <div class="row-actions">
                  <span class="value">${b.actual_yield_bottles ?? "?"} bottles</span>
                  <button class="btn btn-danger btn-sm" onclick="deleteBatch('${b.id}')">Delete</button>
                </div>
              </li>`;
          }).join("")}
      </ul>
    </div>
  `;
}

function submitLogBatch() {
  const recipeId = document.getElementById("f-recipe").value;
  const r = recipes.find((x) => x.id === recipeId);
  if (!r) return showToast("Pick a recipe", true);

  const cost = calcRecipeCost(r);
  const yieldRaw = document.getElementById("f-yield").value;
  const yielded = yieldRaw ? Number(yieldRaw) : cost.bottlesPerBatch;
  const date = document.getElementById("f-date").value || todayISO();

  // Check raw stock is sufficient (mirrors deduct_stock_on_batch's guard).
  const shortfalls = r.ingredients
    .map((ri) => {
      const ing = ingredients.find((i) => i.id === ri.ingredient_id);
      if (!ing) return null;
      if (ing.qty_on_hand < ri.qty_used) return `${ing.name} (need ${ri.qty_used}, have ${ing.qty_on_hand})`;
      return null;
    })
    .filter(Boolean);
  if (shortfalls.length > 0) return showToast("Not enough stock: " + shortfalls.join(", "), true);

  // Deduct ingredients + snapshot usage (mirrors batch_ingredient_usage).
  const usageSnapshot = r.ingredients.map((ri) => {
    const ing = ingredients.find((i) => i.id === ri.ingredient_id);
    if (ing) ing.qty_on_hand -= ri.qty_used;
    return { ingredient_id: ri.ingredient_id, qty_used: ri.qty_used };
  });

  batches.push({
    id: uid(), recipe_id: recipeId, batch_date: date,
    actual_yield_bottles: yielded, notes: "", usage: usageSnapshot,
    cost_per_bottle_snapshot: cost.costPerBottle,
  });

  // Credit finished goods.
  let fg = finishedGoods.find((f) => f.recipe_id === recipeId);
  if (!fg) { fg = { recipe_id: recipeId, qty_on_hand: 0, low_stock_threshold: null }; finishedGoods.push(fg); }
  fg.qty_on_hand += yielded;

  saveAll();
  showToast("Batch logged");
  render_batches();
}

function deleteBatch(id) {
  const b = batches.find((x) => x.id === id);
  if (!b) return;
  const fg = finishedGoods.find((f) => f.recipe_id === b.recipe_id);
  const yielded = b.actual_yield_bottles || 0;

  if (yielded > 0 && (!fg || fg.qty_on_hand < yielded)) {
    return showToast("Can't delete: some of this batch's bottles were already sold", true);
  }
  if (!confirm("Delete this batch? Ingredients and bottle stock will be reversed.")) return;

  // Restore from snapshot, not live recipe (mirrors the real bug fix).
  (b.usage || []).forEach((u) => {
    const ing = ingredients.find((i) => i.id === u.ingredient_id);
    if (ing) ing.qty_on_hand += u.qty_used;
  });
  if (fg) fg.qty_on_hand -= yielded;

  batches = batches.filter((x) => x.id !== id);
  saveAll();
  showToast("Batch deleted, stock reversed");
  render_batches();
}
