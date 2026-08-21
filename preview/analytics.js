function render_analytics() {
  const el = document.getElementById("section-analytics");

  const byRecipe = {};
  sales.forEach((s) => {
    const r = recipes.find((r) => r.id === s.recipe_id);
    const key = s.recipe_id;
    byRecipe[key] = byRecipe[key] || { name: r ? r.name : "(deleted)", qty: 0, revenue: 0, cost: 0 };
    byRecipe[key].qty += s.qty_bottles;
    byRecipe[key].revenue += s.price_charged_total;
    byRecipe[key].cost += (s.cost_per_bottle_snapshot || 0) * s.qty_bottles;
  });
  const rows = Object.values(byRecipe).sort((a, b) => b.revenue - a.revenue);

  const byCustomer = {};
  sales.forEach((s) => {
    const key = s.customer_ref && s.customer_ref.trim() ? s.customer_ref.trim() : null;
    if (!key) return;
    byCustomer[key] = (byCustomer[key] || 0) + 1;
  });
  const repeatCustomers = Object.entries(byCustomer).filter(([, count]) => count >= 2).length;

  el.innerHTML = `
    <div class="section-header"><div><h1>Analytics</h1><p>Real margin vs. theoretical, repeat customers</p></div></div>

    <div class="grid grid-2" style="margin-bottom:16px">
      <div class="stat"><div class="num">${Object.keys(byCustomer).length}</div><div class="label">Named customers</div></div>
      <div class="stat"><div class="num">${repeatCustomers}</div><div class="label">Repeat (2+ sales)</div></div>
    </div>

    <div class="card">
      <p class="card-title">Real margin by recipe (from actual sales)</p>
      <table class="data-table">
        <thead><tr><th>Recipe</th><th>Sold</th><th>Revenue</th><th>Est. cost</th><th>Margin</th></tr></thead>
        <tbody>
          ${rows.length === 0 ? '<tr><td colspan="5" class="text-cell empty-state">No sales yet.</td></tr>' :
            rows.map((r) => {
              const profit = r.revenue - r.cost;
              const marginPct = r.revenue > 0 ? (profit / r.revenue) * 100 : 0;
              return `<tr>
                <td class="text-cell">${r.name}</td>
                <td>${r.qty}</td>
                <td>${money(r.revenue)}</td>
                <td>${money(r.cost)}</td>
                <td>${marginPct.toFixed(0)}%</td>
              </tr>`;
            }).join("")}
        </tbody>
      </table>
    </div>
  `;
}
