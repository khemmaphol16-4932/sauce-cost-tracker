function render_stock() {
  const el = document.getElementById("section-stock");
  const lowCount = ingredients.filter((i) => i.low_stock_threshold != null && i.qty_on_hand < i.low_stock_threshold).length
    + finishedGoods.filter((f) => f.low_stock_threshold != null && f.qty_on_hand < f.low_stock_threshold).length;

  el.innerHTML = `
    <div class="section-header">
      <div><h1>Stock</h1><p>${lowCount > 0 ? lowCount + " item(s) below threshold" : "All stock healthy"}</p></div>
      <div style="display:flex;gap:8px">
        ${ingredients.length > 0 ? '<button class="btn btn-ghost btn-sm" onclick="openPurchaseTripModal()">Purchase trip</button>' : ""}
        <button class="btn btn-primary btn-sm" onclick="openAddIngredientModal()">+ Ingredient</button>
      </div>
    </div>

    ${finishedGoods.length > 0 ? `
    <div class="card">
      <p class="card-title">Bottles in stock</p>
      <ul class="row-list">
        ${finishedGoods.map((fg) => {
          const r = recipes.find((r) => r.id === fg.recipe_id);
          const low = fg.low_stock_threshold != null && fg.qty_on_hand < fg.low_stock_threshold;
          return `
            <li class="row-item">
              <div class="main-text">${r ? r.name : "(deleted recipe)"} ${low ? '<span class="badge badge-alert">low</span>' : ""}</div>
              <span class="value">${fg.qty_on_hand}</span>
            </li>`;
        }).join("")}
      </ul>
    </div>` : ""}

    <div class="card">
      <p class="card-title">Ingredients</p>
      <ul class="row-list">
        ${ingredients.length === 0 ? '<li class="empty-state">No ingredients yet.</li>' :
          ingredients.map((i) => {
            const low = i.low_stock_threshold != null && i.qty_on_hand < i.low_stock_threshold;
            return `
              <li class="row-item">
                <div>
                  <div class="main-text">${i.name} ${low ? '<span class="badge badge-alert">low</span>' : ""}</div>
                  <div class="sub-text">${i.qty_on_hand} ${i.unit} on hand · avg ${money(i.avg_price_per_unit)}/${i.unit}</div>
                </div>
                <div class="row-actions">
                  <button class="btn btn-ghost btn-sm" onclick="openCountModal('${i.id}')">Count</button>
                  <button class="btn btn-ghost btn-sm" onclick="openPurchaseModal('${i.id}')">+ Purchase</button>
                  <button class="btn btn-ghost btn-sm" onclick="openEditIngredientModal('${i.id}')">Edit</button>
                </div>
              </li>`;
          }).join("")}
      </ul>
    </div>
  `;
}

function openAddIngredientModal() {
  openModal("Add ingredient", `
    <div class="field"><label>Name</label><input id="f-name" placeholder="e.g. Dried chili"></div>
    <div class="field-row">
      <div class="field"><label>Unit</label><input id="f-unit" placeholder="g, ml, pcs…"></div>
      <div class="field"><label>Low stock threshold</label><input id="f-threshold" type="number" min="0"></div>
    </div>
    <button class="btn btn-primary" onclick="submitAddIngredient()">Add</button>
  `);
}

function submitAddIngredient() {
  const name = document.getElementById("f-name").value.trim();
  const unit = document.getElementById("f-unit").value.trim();
  const threshold = document.getElementById("f-threshold").value;
  if (!name || !unit) return showToast("Name and unit are required", true);

  ingredients.push({
    id: uid(),
    name,
    unit,
    qty_on_hand: 0,
    avg_price_per_unit: 0,
    low_stock_threshold: threshold ? Number(threshold) : null,
  });
  saveAll();
  closeModal();
  showToast("Ingredient added");
  render_stock();
}

function openEditIngredientModal(id) {
  const i = ingredients.find((x) => x.id === id);
  if (!i) return;
  openModal("Edit ingredient", `
    <div class="field"><label>Name</label><input id="f-name" value="${i.name}"></div>
    <div class="field-row">
      <div class="field"><label>Unit</label><input id="f-unit" value="${i.unit}"></div>
      <div class="field"><label>Low stock threshold</label><input id="f-threshold" type="number" min="0" value="${i.low_stock_threshold ?? ""}"></div>
    </div>
    <div style="display:flex;gap:8px">
      <button class="btn btn-primary" style="flex:1" onclick="submitEditIngredient('${id}')">Save</button>
      <button class="btn btn-danger" onclick="deleteIngredient('${id}')">Delete</button>
    </div>
  `);
}

function submitEditIngredient(id) {
  const i = ingredients.find((x) => x.id === id);
  if (!i) return;
  i.name = document.getElementById("f-name").value.trim() || i.name;
  i.unit = document.getElementById("f-unit").value.trim() || i.unit;
  const threshold = document.getElementById("f-threshold").value;
  i.low_stock_threshold = threshold ? Number(threshold) : null;
  saveAll();
  closeModal();
  showToast("Saved");
  render_stock();
}

function deleteIngredient(id) {
  if (!confirm("Delete this ingredient?")) return;
  ingredients = ingredients.filter((x) => x.id !== id);
  saveAll();
  closeModal();
  showToast("Deleted");
  render_stock();
}

function openPurchaseModal(id) {
  const i = ingredients.find((x) => x.id === id);
  if (!i) return;
  openModal(`Log purchase — ${i.name}`, `
    <div class="field-row">
      <div class="field"><label>Qty bought (${i.unit})</label><input id="f-qty" type="number" min="0"></div>
      <div class="field"><label>Total price paid</label><input id="f-price" type="number" min="0"></div>
    </div>
    <p style="margin:-4px 0 4px;font-size:12px;color:var(--color-text-secondary)">
      Correcting a stock count? Use <strong style="color:var(--color-text)">Count</strong> instead —
      purchases change your average cost.
    </p>
    <button class="btn btn-primary" onclick="submitPurchase('${id}')">Save purchase</button>
  `);
}

// ---- Purchase trip: log several ingredient purchases from one shopping trip
// in a single submission (mirrors logPurchaseTrip in the real app). Each
// line still updates avg_price_per_unit the same way a single purchase does.
let tripLines = [];
let tripDate = todayISO();

function openPurchaseTripModal() {
  tripLines = [];
  tripDate = todayISO();
  renderPurchaseTripModal();
}

function renderPurchaseTripModal() {
  const ingredientOptions = ingredients.map((i) => `<option value="${i.id}">${i.name}</option>`).join("");
  const total = tripLines.reduce((sum, l) => sum + l.price, 0);

  openModal("Log a shopping trip", `
    <div class="field"><label>Date</label><input id="pt-date" type="date" value="${tripDate}" oninput="tripDate=this.value"></div>

    ${tripLines.length > 0 ? `
      <ul class="row-list">
        ${tripLines.map((l, idx) => `
          <li class="row-item">
            <div>
              <div class="main-text">${l.name}</div>
              <div class="sub-text">${l.qty} ${l.unit} · ${money(l.price)}</div>
            </div>
            <button class="btn btn-ghost btn-sm" onclick="removeTripLine(${idx})">✕</button>
          </li>
        `).join("")}
      </ul>
    ` : ""}

    <div class="card" style="padding:12px;border-style:dashed;margin:0">
      <div class="field"><label>Ingredient</label><select id="pt-ingredient">${ingredientOptions}</select></div>
      <div class="field-row" style="margin-top:8px">
        <div class="field"><label>Qty</label><input id="pt-qty" type="number" inputmode="decimal" min="0"></div>
        <div class="field"><label>Price (฿)</label><input id="pt-price" type="number" inputmode="decimal" min="0"></div>
      </div>
      <button class="btn btn-ghost" style="width:100%;margin-top:8px" onclick="addTripLine()">+ Add to trip</button>
    </div>

    <button class="btn btn-primary" style="margin-top:10px" onclick="submitPurchaseTrip()" ${tripLines.length === 0 ? "disabled" : ""}>
      ${tripLines.length > 0 ? `Save trip (${tripLines.length} item${tripLines.length === 1 ? "" : "s"}, ${money(total)})` : "Add items to save"}
    </button>
  `);
}

function addTripLine() {
  const id = document.getElementById("pt-ingredient").value;
  const ing = ingredients.find((x) => x.id === id);
  const qty = Number(document.getElementById("pt-qty").value);
  const price = Number(document.getElementById("pt-price").value);
  if (!ing) return showToast("Pick an ingredient", true);
  if (!(qty > 0)) return showToast("Enter a quantity greater than 0", true);
  if (!(price >= 0)) return showToast("Enter a price", true);

  tripLines.push({ ingredient_id: id, name: ing.name, unit: ing.unit, qty, price });
  renderPurchaseTripModal();
}

function removeTripLine(idx) {
  tripLines.splice(idx, 1);
  renderPurchaseTripModal();
}

function submitPurchaseTrip() {
  if (tripLines.length === 0) return showToast("Add at least one item", true);

  for (const line of tripLines) {
    const ing = ingredients.find((x) => x.id === line.ingredient_id);
    if (!ing) continue;
    const prevTotalValue = ing.qty_on_hand * ing.avg_price_per_unit;
    const newQty = ing.qty_on_hand + line.qty;
    ing.avg_price_per_unit = newQty > 0 ? (prevTotalValue + line.price) / newQty : 0;
    ing.qty_on_hand = newQty;
  }

  const count = tripLines.length;
  saveAll();
  closeModal();
  showToast(`Trip saved (${count} item${count === 1 ? "" : "s"})`);
  tripLines = [];
  render_stock();
}

function submitPurchase(id) {
  const i = ingredients.find((x) => x.id === id);
  if (!i) return;
  const qty = Number(document.getElementById("f-qty").value);
  const price = Number(document.getElementById("f-price").value);
  if (!(qty > 0) || !(price >= 0)) return showToast("Valid quantity and price required", true);

  const prevTotalValue = i.qty_on_hand * i.avg_price_per_unit;
  const newQty = i.qty_on_hand + qty;
  i.avg_price_per_unit = newQty > 0 ? (prevTotalValue + price) / newQty : 0;
  i.qty_on_hand = newQty;

  saveAll();
  closeModal();
  showToast("Purchase logged");
  render_stock();
}

// ---- Stock count (mirrors adjust_ingredient_stock in the real app) ----
// Takes what was actually counted, not a +/- delta. Deliberately never
// touches avg_price_per_unit — that's the whole point: this replaces the
// "log a ฿1 purchase to fix the count" workaround that corrupted costing.
const COUNT_REASONS = ["recount", "spoiled", "used unrecorded", "other"];

function openCountModal(id) {
  const i = ingredients.find((x) => x.id === id);
  if (!i) return;

  openModal(`Stock count — ${i.name}`, `
    <p style="margin:0;font-size:13px;color:var(--color-text-secondary)">
      Recorded: <strong style="color:var(--color-text);font-family:var(--font-mono)">${i.qty_on_hand}</strong> ${i.unit}
    </p>
    <div class="field">
      <label>Actual counted quantity (${i.unit})</label>
      <input id="f-counted" type="number" inputmode="decimal" step="any" min="0"
             value="${i.qty_on_hand}" oninput="updateCountHint(${i.qty_on_hand}, '${i.unit}')">
      <p id="count-hint" style="margin:4px 0 0;font-size:12px;color:var(--color-text-secondary)"></p>
    </div>
    <div class="field">
      <label>Reason</label>
      <div id="reason-pills" style="display:flex;flex-wrap:wrap;gap:8px">
        ${COUNT_REASONS.map((r, idx) => `
          <button type="button" class="btn btn-sm ${idx === 0 ? "btn-primary" : "btn-ghost"}"
                  data-reason="${r}" onclick="selectCountReason('${r}')">${r}</button>
        `).join("")}
      </div>
      <input type="hidden" id="f-reason" value="${COUNT_REASONS[0]}">
    </div>
    <div class="field">
      <label>Note (optional)</label>
      <input id="f-notes" placeholder="Optional note">
    </div>
    <p style="margin:4px 0 0;font-size:12px;color:var(--color-text-secondary)">
      This corrects the quantity only — your average cost per ${i.unit} is not affected.
    </p>
    <button class="btn btn-primary" onclick="submitCount('${id}')">Save count</button>
  `);
}

function selectCountReason(reason) {
  document.getElementById("f-reason").value = reason;
  document.querySelectorAll("#reason-pills button").forEach((btn) => {
    const active = btn.dataset.reason === reason;
    btn.className = "btn btn-sm " + (active ? "btn-primary" : "btn-ghost");
  });
}

function updateCountHint(recorded, unit) {
  const val = Number(document.getElementById("f-counted").value);
  const hint = document.getElementById("count-hint");
  if (!Number.isFinite(val)) {
    hint.textContent = "";
    return;
  }
  const delta = val - recorded;
  hint.textContent = delta === 0 ? "" : `Will change by ${delta > 0 ? "+" : "−"}${Math.abs(delta)} ${unit}`;
}

function submitCount(id) {
  const i = ingredients.find((x) => x.id === id);
  if (!i) return;

  const counted = Number(document.getElementById("f-counted").value);
  const reason = document.getElementById("f-reason").value;
  const notes = document.getElementById("f-notes").value.trim();

  if (!Number.isFinite(counted) || counted < 0) {
    return showToast("Enter the quantity you counted (0 or more)", true);
  }
  const delta = counted - i.qty_on_hand;
  if (delta === 0) {
    return showToast("Counted quantity is already the recorded quantity — nothing to adjust", true);
  }

  stockAdjustments.push({
    id: uid(),
    kind: "ingredient",
    ingredient_id: id,
    delta,
    resulting_qty: counted,
    reason,
    notes,
    adjustment_date: todayISO(),
    created_at: new Date().toISOString(),
  });

  // The avg_price_per_unit line is deliberately absent here.
  i.qty_on_hand = counted;

  saveAll();
  closeModal();
  showToast(`Stock count saved (avg cost unchanged: ${money(i.avg_price_per_unit)}/${i.unit})`);
  render_stock();
}
