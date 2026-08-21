function render_dashboard() {
  const el = document.getElementById("section-dashboard");

  const totalStockValue = ingredients.reduce((s, i) => s + i.qty_on_hand * i.avg_price_per_unit, 0);
  const lowIngredients = ingredients.filter((i) => i.low_stock_threshold != null && i.qty_on_hand < i.low_stock_threshold);
  const lowFinished = finishedGoods.filter((f) => f.low_stock_threshold != null && f.qty_on_hand < f.low_stock_threshold);
  const revenueTotal = sales.reduce((s, sale) => s + sale.price_charged_total, 0);
  const expenseTotal = expenses.reduce((s, e) => s + e.amount, 0);

  const bestSellers = {};
  sales.forEach((s) => {
    const r = recipes.find((r) => r.id === s.recipe_id);
    const key = s.recipe_id;
    bestSellers[key] = bestSellers[key] || { name: r ? r.name : "(deleted)", qty: 0, revenue: 0 };
    bestSellers[key].qty += s.qty_bottles;
    bestSellers[key].revenue += s.price_charged_total;
  });
  const bestSellersList = Object.values(bestSellers).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

  el.innerHTML = `
    <div class="section-header">
      <div>
        <h1>Dashboard</h1>
        <p>Offline preview — mock data, resets any time</p>
      </div>
      <button class="btn btn-ghost btn-sm" onclick="resetDemoData()">Reset demo data</button>
    </div>

    <div class="grid grid-4" style="margin-bottom:16px">
      <div class="stat"><div class="num" style="color:var(--color-accent)">${money(revenueTotal)}</div><div class="label">Revenue</div></div>
      <div class="stat"><div class="num">${ingredients.length}</div><div class="label">Ingredients</div></div>
      <div class="stat"><div class="num">${recipes.length}</div><div class="label">Recipes</div></div>
      <div class="stat"><div class="num">${batches.length}</div><div class="label">Batches</div></div>
      <div class="stat"><div class="num">${money(totalStockValue)}</div><div class="label">Stock value</div></div>
      <div class="stat"><div class="num" style="color:${lowIngredients.length + lowFinished.length > 0 ? "var(--color-alert)" : "var(--color-text)"}">${lowIngredients.length + lowFinished.length}</div><div class="label">Low stock</div></div>
      <div class="stat"><div class="num">${money(expenseTotal)}</div><div class="label">Expenses</div></div>
      <div class="stat"><div class="num">${money(revenueTotal - expenseTotal)}</div><div class="label">Net (rev − exp)</div></div>
    </div>

    <div class="grid grid-2">
      <div class="card">
        <p class="card-title">Best sellers</p>
        <p class="card-sub">By revenue</p>
        <ul class="row-list">
          ${bestSellersList.length === 0 ? '<li class="empty-state">No sales logged yet.</li>' :
            bestSellersList.map((b) => `
              <li class="row-item">
                <div><div class="main-text">${b.name}</div><div class="sub-text">${b.qty} bottles sold</div></div>
                <span class="value">${money(b.revenue)}</span>
              </li>`).join("")}
        </ul>
      </div>

      <div class="card">
        <p class="card-title">Recipe margins</p>
        <p class="card-sub">Theoretical, from target sell price</p>
        <ul class="row-list">
          ${recipes.map((r) => {
            const c = calcRecipeCost(r);
            return `
              <li class="row-item">
                <div class="main-text">${r.name}</div>
                <span class="badge badge-${c.indicator}">${c.marginPct.toFixed(0)}% margin</span>
              </li>`;
          }).join("")}
        </ul>
      </div>
    </div>
  `;
}
