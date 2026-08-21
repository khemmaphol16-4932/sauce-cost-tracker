// ---- Quick-sell defaults: last price/platform per recipe, falling back to
// the recipe's target sell price at 0% fee (self-sell) if it's never sold.
function getQuickSellDefaults() {
  const lastByRecipe = new Map();
  // sales are pushed in chronological order, so walk backwards for "most recent".
  for (let i = sales.length - 1; i >= 0; i--) {
    const s = sales[i];
    if (lastByRecipe.has(s.recipe_id)) continue;
    lastByRecipe.set(s.recipe_id, {
      unitPrice: s.qty_bottles > 0 ? s.price_charged_total / s.qty_bottles : 0,
      platform: s.platform,
    });
  }
  return recipes.map((r) => {
    const last = lastByRecipe.get(r.id);
    return {
      recipeId: r.id,
      recipeName: r.name,
      unitPrice: last ? last.unitPrice : r.target_sell_price || 0,
      platform: last ? last.platform : "self",
    };
  });
}

function render_sales() {
  const el = document.getElementById("section-sales");
  const recipeOptions = recipes.map((r) => `<option value="${r.id}">${r.name}</option>`).join("");
  const quickDefaults = getQuickSellDefaults();

  // ---- Quick check summary: how many, how much, who ----
  const totalBottles = sales.reduce((sum, s) => sum + s.qty_bottles, 0);
  const totalRevenue = sales.reduce((sum, s) => sum + s.price_charged_total, 0);
  const customerCounts = {};
  sales.forEach((s) => {
    const key = (s.customer_ref || "").trim();
    if (!key) return;
    customerCounts[key] = (customerCounts[key] || 0) + 1;
  });
  const topCustomers = Object.entries(customerCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  el.innerHTML = `
    <div class="section-header"><div><h1>Sales</h1><p>Log sales, deducts bottle stock</p></div></div>

    ${quickDefaults.length > 0 ? `
    <div class="card">
      <p class="card-title">Quick sell</p>
      <p class="card-sub">Tap a recipe — prefills qty 1 at the last price</p>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${quickDefaults.map((q) => `
          <button class="btn btn-ghost" style="justify-content:space-between;width:100%;padding:12px 14px"
                  onclick="openQuickSell('${q.recipeId}')">
            <span>${q.recipeName}</span>
            <span class="value">${money(q.unitPrice)}</span>
          </button>
        `).join("")}
      </div>
    </div>` : ""}

    <div class="card">
      <p class="card-title">Quick check</p>
      <p class="card-sub">How many, how much, who</p>
      <div class="grid grid-3">
        <div class="stat"><div class="num">${totalBottles}</div><div class="label">Bottles sold</div></div>
        <div class="stat"><div class="num">${money(totalRevenue)}</div><div class="label">Revenue (price × qty)</div></div>
        <div class="stat"><div class="num">${Object.keys(customerCounts).length}</div><div class="label">Named customers</div></div>
      </div>
      ${topCustomers.length > 0 ? `
        <ul class="row-list" style="margin-top:10px">
          ${topCustomers.map(([name, count]) => `
            <li class="row-item">
              <span class="main-text">${name}</span>
              <span class="value">${count} order${count === 1 ? "" : "s"}</span>
            </li>
          `).join("")}
        </ul>
      ` : ""}
    </div>

    <div class="card">
      <p class="card-title">Log a sale</p>
      ${recipes.length === 0 ? '<p class="empty-state">Create a recipe first.</p>' : `
        <div class="field"><label>Recipe</label><select id="f-recipe">${recipeOptions}</select></div>
        <div class="field-row" style="margin-top:8px">
          <div class="field"><label>Bottles sold</label><input id="f-qty" type="number" min="0" value="1"></div>
          <div class="field"><label>Total price (฿)</label><input id="f-price" type="number" min="0"></div>
        </div>
        <div class="field-row" style="margin-top:8px">
          <div class="field"><label>Platform</label>
            <select id="f-platform">
              <option value="self">Self-sell</option>
              <option value="tiktok">TikTok Shop</option>
              <option value="shopee">Shopee</option>
              <option value="lazada">Lazada</option>
            </select>
          </div>
          <div class="field"><label>Date</label><input id="f-date" type="date" value="${todayISO()}"></div>
        </div>
        <div class="field" style="margin-top:8px">
          <label>Customer / room (optional)</label>
          <input id="f-customer" placeholder="e.g. table 3, Nok">
        </div>
        <button class="btn btn-primary" style="margin-top:10px" onclick="submitLogSale()">Log sale</button>
      `}
    </div>

    <div class="card">
      <p class="card-title">Sales history</p>
      <ul class="row-list">
        ${sales.length === 0 ? '<li class="empty-state">No sales logged yet.</li>' :
          [...sales].reverse().map((s) => {
            const r = recipes.find((r) => r.id === s.recipe_id);
            return `
              <li class="row-item">
                <div>
                  <div class="main-text">${r ? r.name : "(deleted)"}</div>
                  <div class="sub-text">${s.qty_bottles} bottles · ${s.platform} · ${s.sale_date}${s.customer_ref ? " · " + s.customer_ref : ""}</div>
                </div>
                <div class="row-actions">
                  <span class="value">${money(s.price_charged_total)}</span>
                  <button class="btn btn-danger btn-sm" onclick="voidSale('${s.id}')">Void</button>
                </div>
              </li>`;
          }).join("")}
      </ul>
    </div>
  `;
}

// ---- Quick sell: one tap → prefilled modal → one more tap to confirm ----
function openQuickSell(recipeId) {
  const r = recipes.find((x) => x.id === recipeId);
  if (!r) return;
  const q = getQuickSellDefaults().find((x) => x.recipeId === recipeId);
  const fg = finishedGoods.find((f) => f.recipe_id === recipeId);
  const available = fg ? fg.qty_on_hand : 0;

  openModal(`Quick sell — ${r.name}`, `
    <p style="margin:0;font-size:12px;color:var(--color-text-secondary)">${available} bottles in stock</p>
    <div class="field">
      <label>Qty</label>
      <div style="display:flex;align-items:center;gap:10px">
        <button type="button" onclick="stepQuickSellQty(-1)"
                style="width:56px;height:56px;flex-shrink:0;border:none;border-radius:var(--radius-md);
                       background:var(--color-alert);color:#fff;font-size:28px;font-weight:700;
                       line-height:1;cursor:pointer">−</button>
        <input id="qs-qty" type="number" inputmode="numeric" min="1" value="1"
               style="text-align:center;font-size:24px;font-weight:700;font-family:var(--font-mono);
                      height:56px;color:var(--color-accent)"
               oninput="updateQuickSellTotal()">
        <button type="button" onclick="stepQuickSellQty(1)"
                style="width:56px;height:56px;flex-shrink:0;border:none;border-radius:var(--radius-md);
                       background:var(--color-accent);color:#05191c;font-size:28px;font-weight:700;
                       line-height:1;cursor:pointer">+</button>
      </div>
    </div>
    <div class="field" style="margin-top:8px">
      <label>Unit price (฿)</label>
      <input id="qs-unit-price" type="number" inputmode="decimal" min="0" value="${q.unitPrice.toFixed(2)}" oninput="updateQuickSellTotal()">
    </div>
    <p style="margin:4px 0 0;font-size:13px;color:var(--color-text-secondary)">
      Total: <strong id="qs-total" style="color:var(--color-text);font-family:var(--font-mono)">${money(q.unitPrice)}</strong>
    </p>
    <div class="field" style="margin-top:8px">
      <label>Customer / room (optional)</label>
      <input id="qs-customer" placeholder="e.g. table 3, Nok">
    </div>
    <input type="hidden" id="qs-platform" value="${q.platform}">
    <button class="btn btn-primary" style="margin-top:10px" onclick="submitQuickSell('${recipeId}')">
      Log sale
    </button>
  `);
}

function stepQuickSellQty(delta) {
  const input = document.getElementById("qs-qty");
  const next = Math.max(1, (Number(input.value) || 0) + delta);
  input.value = next;
  updateQuickSellTotal();
}

function updateQuickSellTotal() {
  const qty = Number(document.getElementById("qs-qty").value) || 0;
  const unitPrice = Number(document.getElementById("qs-unit-price").value) || 0;
  document.getElementById("qs-total").textContent = money(qty * unitPrice);
}

function submitQuickSell(recipeId) {
  const r = recipes.find((x) => x.id === recipeId);
  if (!r) return;

  const qty = Number(document.getElementById("qs-qty").value);
  const unitPrice = Number(document.getElementById("qs-unit-price").value);
  const platform = document.getElementById("qs-platform").value;
  const customer = document.getElementById("qs-customer").value.trim();

  if (!(qty > 0) || !(unitPrice >= 0)) return showToast("Valid quantity and price required", true);

  const fg = finishedGoods.find((f) => f.recipe_id === recipeId);
  const available = fg ? fg.qty_on_hand : 0;
  if (available < qty) return showToast(`Not enough bottles in stock: need ${qty}, have ${available}`, true);

  fg.qty_on_hand -= qty;

  const cost = calcRecipeCost(r);
  sales.push({
    id: uid(),
    recipe_id: recipeId,
    qty_bottles: qty,
    price_charged_total: qty * unitPrice,
    platform,
    payment_status: "paid",
    sale_date: todayISO(),
    customer_ref: customer,
    notes: "",
    cost_per_bottle_snapshot: cost.costPerBottle,
  });

  saveAll();
  closeModal();
  showToast("Sale logged, stock deducted");
  render_sales();
}

function submitLogSale() {
  const recipeId = document.getElementById("f-recipe").value;
  const r = recipes.find((x) => x.id === recipeId);
  if (!r) return showToast("Pick a recipe", true);

  const qty = Number(document.getElementById("f-qty").value);
  const price = Number(document.getElementById("f-price").value);
  const platform = document.getElementById("f-platform").value;
  const date = document.getElementById("f-date").value || todayISO();
  const customer = document.getElementById("f-customer").value.trim();
  if (!(qty > 0) || !(price >= 0)) return showToast("Valid quantity and price required", true);

  const fg = finishedGoods.find((f) => f.recipe_id === recipeId);
  const available = fg ? fg.qty_on_hand : 0;
  if (available < qty) return showToast(`Not enough bottles in stock: need ${qty}, have ${available}`, true);

  fg.qty_on_hand -= qty;

  const cost = calcRecipeCost(r);
  sales.push({
    id: uid(), recipe_id: recipeId, qty_bottles: qty, price_charged_total: price,
    platform, payment_status: "paid", sale_date: date, customer_ref: customer, notes: "",
    cost_per_bottle_snapshot: cost.costPerBottle,
  });

  saveAll();
  showToast("Sale logged, stock deducted");
  render_sales();
}

function voidSale(id) {
  const s = sales.find((x) => x.id === id);
  if (!s) return;
  if (!confirm("Void this sale? Bottles will be credited back to stock.")) return;

  let fg = finishedGoods.find((f) => f.recipe_id === s.recipe_id);
  if (!fg) { fg = { recipe_id: s.recipe_id, qty_on_hand: 0, low_stock_threshold: null }; finishedGoods.push(fg); }
  fg.qty_on_hand += s.qty_bottles;

  sales = sales.filter((x) => x.id !== id);
  saveAll();
  showToast("Sale voided, stock credited back");
  render_sales();
}
