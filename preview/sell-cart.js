// ---- Sell cart (mirrors src/app/sales/sell-cart.tsx) ----
// Tap a tile = +1 bottle. A bar pinned above the tab bar shows the running
// total; Checkout opens one sheet for platform, payment and an adjusted total.
// Also: the phone "More" page and the Make (Batches | Recipes) switcher.

const PLATFORM_OPTIONS = [
  { value: "self", label: "Self-sell", feePct: 0 },
  { value: "tiktok", label: "TikTok Shop", feePct: 5 },
  { value: "shopee", label: "Shopee", feePct: 5.42 },
  { value: "lazada", label: "Lazada", feePct: 6.3 },
  { value: "other", label: "Other", feePct: 0 },
];
const PAYMENT_METHODS = ["cash", "transfer", "cod"];

// Stand-in for the real app's Shop & label settings (More → Shop & label).
const PREVIEW_SHOP = {
  businessName: "Ordexa Sauce",
  phone: "081-234-5678",
  contactLine: "LINE @ordexa",
  address: null,
  logoDataUrl: null,
  footer: "ขอบคุณที่อุดหนุนนะคะ ♥",
};

let cart = {};
let pendingLabel = null;
let checkout = { platform: "self", feePct: 0, paymentMethod: "cash" };

function stockFor(recipeId) {
  const fg = finishedGoods.find((f) => f.recipe_id === recipeId);
  return fg ? fg.qty_on_hand : 0;
}

function cartLines() {
  const defaults = getQuickSellDefaults();
  return Object.entries(cart)
    .filter(([, q]) => q > 0)
    .map(([id, qty]) => {
      const d = defaults.find((x) => x.recipeId === id);
      return { id, name: d.recipeName, unitPrice: d.unitPrice, qty, lineTotal: qty * d.unitPrice };
    });
}

function renderSellTiles() {
  const defaults = getQuickSellDefaults();
  if (defaults.length === 0) {
    return '<div class="card"><p class="empty-state">Create a recipe first under Make → Recipes.</p></div>';
  }
  return `
    <div class="sell-grid">
      ${defaults.map((d) => {
        const qty = cart[d.recipeId] || 0;
        const left = stockFor(d.recipeId);
        const out = left <= 0;
        return `
          <button class="sell-tile${qty > 0 ? " in-cart" : ""}" ${out ? "disabled" : ""} onclick="addToCart('${d.recipeId}')">
            ${qty > 0 ? `<span class="sell-badge">${qty}</span>` : ""}
            <span class="sell-name">${d.recipeName}</span>
            <span class="sell-foot">
              <span class="sell-price">฿${d.unitPrice.toFixed(0)}</span>
              <span class="sell-left${out ? " out" : ""}">${out ? "Out" : left + " left"}</span>
            </span>
          </button>`;
      }).join("")}
    </div>`;
}

function renderCartBar() {
  let bar = document.getElementById("cart-bar");
  const lines = cartLines();
  const bottles = lines.reduce((s, l) => s + l.qty, 0);
  const total = lines.reduce((s, l) => s + l.lineTotal, 0);
  const onSell = document.getElementById("section-sales").classList.contains("active");
  if (!bottles || !onSell) {
    if (bar) bar.remove();
    document.body.classList.remove("has-cart");
    return;
  }
  if (!bar) {
    bar = document.createElement("div");
    bar.id = "cart-bar";
    bar.className = "cart-bar";
    document.body.appendChild(bar);
  }
  document.body.classList.add("has-cart");
  bar.innerHTML = `
    <button class="btn btn-ghost cart-clear" onclick="clearCart()">Clear</button>
    <button class="btn btn-primary cart-go" onclick="openCheckout()">
      <span>${bottles} bottle${bottles === 1 ? "" : "s"}</span>
      <span class="mono">฿${total.toFixed(0)} →</span>
    </button>`;
}

function addToCart(id) {
  const current = cart[id] || 0;
  const left = stockFor(id);
  if (current >= left) {
    const r = recipes.find((x) => x.id === id);
    return showToast(`Only ${left} ${r ? r.name : ""} in stock`, true);
  }
  cart[id] = current + 1;
  render_sales();
}

function setCartQty(id, qty) {
  cart[id] = Math.max(0, Math.min(qty, stockFor(id)));
  if (cartLines().length === 0) {
    closeModal();
    render_sales();
    return;
  }
  render_sales();
  openCheckout(true);
}

function clearCart() {
  cart = {};
  render_sales();
}

function pickPlatform(value) {
  const p = PLATFORM_OPTIONS.find((x) => x.value === value);
  if (!p) return;
  checkout.platform = p.value;
  checkout.feePct = p.feePct;
  // Marketplace orders are paid out by the platform, not into the drawer.
  checkout.paymentMethod = p.value === "self" ? "cash" : "";
  openCheckout(true);
}

function pickPayment(m) {
  checkout.paymentMethod = checkout.paymentMethod === m ? "" : m;
  openCheckout(true);
}

function openCheckout(keepInputs) {
  const prevTotal = keepInputs ? (document.getElementById("co-total") || {}).value || "" : "";
  const prevCustomer = keepInputs ? (document.getElementById("co-customer") || {}).value || "" : "";
  const lines = cartLines();
  const listTotal = lines.reduce((s, l) => s + l.lineTotal, 0);

  openModal("Checkout", `
    <ul class="co-lines">
      ${lines.map((l) => `
        <li>
          <div class="co-name">
            <div class="main-text">${l.name}</div>
            <div class="sub-text mono">฿${l.unitPrice.toFixed(0)} × ${l.qty} = ฿${l.lineTotal.toFixed(0)}</div>
          </div>
          <button class="step" aria-label="One less" onclick="setCartQty('${l.id}', ${l.qty - 1})">−</button>
          <span class="mono co-qty">${l.qty}</span>
          <button class="step" aria-label="One more" onclick="setCartQty('${l.id}', ${l.qty + 1})">+</button>
        </li>`).join("")}
    </ul>

    <div class="field"><label>Sold on</label>
      <div class="chips">
        ${PLATFORM_OPTIONS.map((p) => `<button class="chip${checkout.platform === p.value ? " on" : ""}" onclick="pickPlatform('${p.value}')">${p.label}</button>`).join("")}
      </div>
      ${checkout.feePct > 0 ? `<p class="sub-text" style="margin:4px 0 0">Platform fee ${checkout.feePct}%</p>` : ""}
    </div>

    <div class="field"><label>Paid by</label>
      <div class="chips">
        ${PAYMENT_METHODS.map((m) => `<button class="chip${checkout.paymentMethod === m ? " on" : ""}" onclick="pickPayment('${m}')">${m === "cod" ? "COD" : m[0].toUpperCase() + m.slice(1)}</button>`).join("")}
      </div>
    </div>

    <div class="field"><label>Total charged (฿) — change for a discount</label>
      <input id="co-total" type="number" inputmode="decimal" min="0" placeholder="${listTotal.toFixed(0)}" value="${prevTotal}"
             oninput="document.getElementById('co-charge').textContent = 'Charge ฿' + (this.value === '' ? ${listTotal.toFixed(0)} : Number(this.value).toFixed(0))">
    </div>
    <div class="field"><label>Customer name (printed on the label)</label>
      <input id="co-customer" placeholder="e.g. room 204, Nok" value="${prevCustomer}">
    </div>

    <button class="btn btn-primary co-charge" id="co-charge" onclick="submitCart()">Charge ฿${prevTotal === "" ? listTotal.toFixed(0) : Number(prevTotal).toFixed(0)}</button>
  `);
}

function submitCart() {
  const lines = cartLines();
  if (lines.length === 0) return;
  const listTotal = lines.reduce((s, l) => s + l.lineTotal, 0);
  const raw = document.getElementById("co-total").value.trim();
  const charged = raw === "" ? listTotal : Number(raw);
  if (!(charged >= 0)) return showToast("Enter a valid total", true);
  const customer = document.getElementById("co-customer").value.trim();

  for (const l of lines) {
    if (stockFor(l.id) < l.qty) return showToast(`Not enough ${l.name}: need ${l.qty}, have ${stockFor(l.id)}`, true);
  }

  // Same allocation as the real action: spread an adjusted total by line share.
  const ratio = listTotal > 0 ? charged / listTotal : 0;
  let allocated = 0;
  lines.forEach((l, i) => {
    const price = i === lines.length - 1
      ? Math.round((charged - allocated) * 100) / 100
      : Math.round(l.lineTotal * ratio * 100) / 100;
    allocated += price;
    finishedGoods.find((f) => f.recipe_id === l.id).qty_on_hand -= l.qty;
    const r = recipes.find((x) => x.id === l.id);
    sales.push({
      id: uid(), recipe_id: l.id, qty_bottles: l.qty, price_charged_total: price,
      platform: checkout.platform, payment_status: "paid", payment_method: checkout.paymentMethod,
      sale_date: todayISO(), customer_ref: customer, notes: "",
      cost_per_bottle_snapshot: calcRecipeCost(r).costPerBottle,
    });
  });

  const bottles = lines.reduce((s, l) => s + l.qty, 0);
  saveAll();
  cart = {};
  render_sales();

  // Real app: render the label while saving, then one tap → Share Sheet → PeriPage.
  renderReceiptFile({
    ...PREVIEW_SHOP,
    dateLabel: todayISO(),
    lines: lines.map((l) => ({ name: l.name, qty: l.qty, price: l.lineTotal })),
    total: charged,
    customerRef: customer || null,
  }).then((file) => {
    pendingLabel = file;
    const url = URL.createObjectURL(file);
    openModal("Sold ✓", `
      <p style="margin:0 0 12px;text-align:center">${bottles} bottle${bottles === 1 ? "" : "s"} · <span class="mono">฿${charged.toFixed(0)}</span>${customer ? " for <strong>" + customer + "</strong>" : ""}</p>
      <div style="display:flex;justify-content:center;background:var(--color-bg);border-radius:var(--radius-md);padding:12px;margin-bottom:12px">
        <img src="${url}" alt="Label preview" style="width:100%;max-width:220px;box-shadow:0 8px 24px rgba(0,0,0,.4)">
      </div>
      <button class="btn btn-primary co-charge" onclick="printPendingLabel()">Print label</button>
      <p class="sub-text" style="text-align:center;margin:6px 0 0">Opens the share sheet — choose PeriPage to print.</p>
      <button class="btn btn-ghost co-charge" style="margin-top:8px" onclick="closeModal()">Done</button>
    `);
  }).catch(() => {
    closeModal();
    showToast(`Sold ${bottles} bottle${bottles === 1 ? "" : "s"} · ฿${charged.toFixed(0)}`);
  });
}

function printPendingLabel() {
  if (!pendingLabel) return;
  shareReceiptFile(pendingLabel, PREVIEW_SHOP.businessName).catch(() => showToast("Couldn't open the print sheet", true));
}

// Re-render the pinned bar whenever Sell renders or the user leaves it.
(function wrapRenderSales() {
  const original = window.render_sales;
  window.render_sales = function () {
    original();
    renderCartBar();
  };
  const originalNav = window.nav;
  window.nav = function (name) {
    originalNav(name);
    renderCartBar();
  };
})();

// ---- Make switcher + phone More page ----
function makeSwitcher(active) {
  return `
    <div class="make-switch phone-only-block">
      <button class="${active === "batches" ? "on" : ""}" onclick="nav('batches')">Batches</button>
      <button class="${active === "recipes" ? "on" : ""}" onclick="nav('recipes')">Recipes</button>
    </div>`;
}

function render_more() {
  const items = [
    ["closing", "Daily closing", "Count the drawer, compare to expected cash"],
    ["financials", "Financials", "Buying list, expenses, revenue/spend/profit"],
    ["analytics", "Analytics", "Repeat customers, peak hours, waste logging"],
  ];
  document.getElementById("section-more").innerHTML = `
    <div class="section-header"><div><h1>More</h1></div></div>
    ${items.map(([sec, label, desc]) => `
      <button class="card more-link" onclick="nav('${sec}')">
        <span><span class="more-title">${label}</span><span class="more-desc">${desc}</span></span>
        <span aria-hidden="true">›</span>
      </button>`).join("")}
    <button class="btn btn-danger more-signout" onclick="showToast('Sign out lives here now (preview only)')">Sign out</button>
  `;
}
