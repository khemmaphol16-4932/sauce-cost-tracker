function render_financials() {
  const el = document.getElementById("section-financials");
  const revenueTotal = sales.reduce((s, x) => s + x.price_charged_total, 0);
  const ingredientSpend = ingredients.reduce((s, i) => s + i.qty_on_hand * i.avg_price_per_unit, 0);
  const expenseTotal = expenses.reduce((s, e) => s + e.amount, 0);
  const profit = revenueTotal - expenseTotal;

  el.innerHTML = `
    <div class="section-header"><div><h1>Financials</h1><p>Revenue, spend, and expenses overview</p></div></div>

    <div class="grid grid-3" style="margin-bottom:16px">
      <div class="stat"><div class="num" style="color:var(--color-success)">${money(revenueTotal)}</div><div class="label">Revenue</div></div>
      <div class="stat"><div class="num" style="color:var(--color-alert)">${money(expenseTotal)}</div><div class="label">Expenses</div></div>
      <div class="stat"><div class="num" style="color:${profit >= 0 ? "var(--color-success)" : "var(--color-alert)"}">${money(profit)}</div><div class="label">Net profit</div></div>
    </div>

    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <p class="card-title" style="margin:0">Expenses</p>
        <button class="btn btn-ghost btn-sm" onclick="openAddExpenseModal()">+ Expense</button>
      </div>
      <ul class="row-list" style="margin-top:10px">
        ${expenses.length === 0 ? '<li class="empty-state">No expenses logged yet.</li>' :
          [...expenses].reverse().map((e) => `
            <li class="row-item">
              <div><div class="main-text">${e.category}</div><div class="sub-text">${e.expense_date}${e.notes ? " · " + e.notes : ""}</div></div>
              <div class="row-actions">
                <span class="value">${money(e.amount)}</span>
                <button class="btn btn-danger btn-sm" onclick="deleteExpense('${e.id}')">✕</button>
              </div>
            </li>`).join("")}
      </ul>
    </div>

    <div class="card">
      <p class="card-title">Ingredient buying list (current stock value)</p>
      <table class="data-table">
        <thead><tr><th>Ingredient</th><th>Qty</th><th>Avg price</th><th>Value</th></tr></thead>
        <tbody>
          ${ingredients.map((i) => `
            <tr>
              <td class="text-cell">${i.name}</td>
              <td>${i.qty_on_hand} ${i.unit}</td>
              <td>${money(i.avg_price_per_unit)}</td>
              <td>${money(i.qty_on_hand * i.avg_price_per_unit)}</td>
            </tr>`).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function openAddExpenseModal() {
  openModal("Add expense", `
    <div class="field"><label>Category</label><input id="f-category" placeholder="Packaging, marketing, rent…"></div>
    <div class="field-row">
      <div class="field"><label>Amount (฿)</label><input id="f-amount" type="number" min="0"></div>
      <div class="field"><label>Date</label><input id="f-date" type="date" value="${todayISO()}"></div>
    </div>
    <div class="field"><label>Notes (optional)</label><input id="f-notes"></div>
    <button class="btn btn-primary" onclick="submitAddExpense()">Add</button>
  `);
}

function submitAddExpense() {
  const category = document.getElementById("f-category").value.trim();
  const amount = Number(document.getElementById("f-amount").value);
  const date = document.getElementById("f-date").value || todayISO();
  const notes = document.getElementById("f-notes").value.trim();
  if (!category || !(amount >= 0)) return showToast("Category and a valid amount required", true);

  expenses.push({ id: uid(), category, amount, expense_date: date, notes });
  saveAll();
  closeModal();
  showToast("Expense added");
  render_financials();
}

function deleteExpense(id) {
  expenses = expenses.filter((x) => x.id !== id);
  saveAll();
  showToast("Expense deleted");
  render_financials();
}
