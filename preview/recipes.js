let currentRecipeId = null;

function render_recipes() {
  const el = document.getElementById("section-recipes");
  el.innerHTML = `
    <div class="section-header">
      <div><h1>Recipes</h1><p>Cost & margin per recipe</p></div>
      <button class="btn btn-primary btn-sm" onclick="openAddRecipeModal()">+ Recipe</button>
    </div>
    <div class="grid grid-2" id="recipe-cards"></div>
  `;

  const cards = document.getElementById("recipe-cards");
  if (recipes.length === 0) {
    cards.innerHTML = '<p class="empty-state">No recipes yet.</p>';
    return;
  }

  cards.innerHTML = recipes.map((r) => {
    const c = calcRecipeCost(r);
    return `
      <div class="card" style="cursor:pointer" onclick="openRecipeDetail('${r.id}')">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <p class="card-title">${r.name}</p>
          <span class="badge badge-${c.indicator}">${c.marginPct.toFixed(0)}%</span>
        </div>
        <p class="card-sub">~${c.bottlesPerBatch} bottles/batch · cost ${money(c.costPerBottle)}/bottle · sell ${money(r.target_sell_price || 0)}</p>
      </div>`;
  }).join("");
}

function openAddRecipeModal() {
  openModal("New recipe", `
    <div class="field"><label>Name</label><input id="f-name" placeholder="e.g. Nam Prik Chili Sauce"></div>
    <div class="field-row">
      <div class="field"><label>Bottle size (ml)</label><input id="f-bottle" type="number" min="0" value="250"></div>
      <div class="field"><label>Batch volume (ml)</label><input id="f-batch" type="number" min="0" value="5000"></div>
    </div>
    <button class="btn btn-primary" onclick="submitAddRecipe()">Create</button>
  `);
}

function submitAddRecipe() {
  const name = document.getElementById("f-name").value.trim();
  const bottle = Number(document.getElementById("f-bottle").value);
  const batch = Number(document.getElementById("f-batch").value);
  if (!name || !(bottle > 0) || !(batch > 0)) return showToast("Name, bottle size, batch volume required", true);

  recipes.push({
    id: uid(), name, bottle_size_ml: bottle, batch_volume_ml: batch,
    target_sell_price: null, platform_fee_pct: 0, vat_pct: 0,
    labor_hours_per_batch: 0, labor_rate_per_hour: 0, overhead_per_batch: 0,
    waste_pct: 0, evaporation_loss_pct: 0, ingredients: [], packaging: [],
  });
  saveAll();
  closeModal();
  showToast("Recipe created");
  render_recipes();
}

function openRecipeDetail(id) {
  currentRecipeId = id;
  const r = recipes.find((x) => x.id === id);
  if (!r) return;
  const c = calcRecipeCost(r);

  const ingredientOptions = ingredients.map((i) => `<option value="${i.id}">${i.name} (${i.unit})</option>`).join("");

  openModal(r.name, `
    <div class="card" style="margin:0 0 4px">
      <p class="card-title">Cost & margin</p>
      <div class="row-item"><span class="sub-text">Cost / bottle</span><span class="value">${money(c.costPerBottle)}</span></div>
      <div class="row-item"><span class="sub-text">Profit / bottle</span><span class="value">${money(c.profitPerBottle)}</span></div>
      <div class="row-item"><span class="sub-text">Margin</span><span class="badge badge-${c.indicator}">${c.marginPct.toFixed(0)}%</span></div>
    </div>

    <div class="field-row">
      <div class="field"><label>Target sell price</label><input id="f-price" type="number" min="0" value="${r.target_sell_price ?? ""}" onchange="updateRecipeField('price', this.value)"></div>
      <div class="field"><label>Platform fee %</label><input id="f-fee" type="number" min="0" max="100" value="${r.platform_fee_pct}" onchange="updateRecipeField('fee', this.value)"></div>
    </div>

    <p class="card-title" style="margin-top:8px">Ingredients</p>
    <ul class="row-list">
      ${r.ingredients.map((ri) => {
        const ing = ingredients.find((i) => i.id === ri.ingredient_id);
        return `<li class="row-item">
          <span class="main-text">${ing ? ing.name : "(deleted)"}</span>
          <span class="value">${ri.qty_used} ${ing ? ing.unit : ""}
            <button class="btn btn-danger btn-sm" onclick="removeRecipeIngredient('${ri.ingredient_id}')" style="margin-left:6px">✕</button>
          </span>
        </li>`;
      }).join("") || '<li class="empty-state">None yet.</li>'}
    </ul>
    <div class="field-row">
      <div class="field" style="flex:2"><label>Add ingredient</label><select id="f-add-ing">${ingredientOptions}</select></div>
      <div class="field"><label>Qty</label><input id="f-add-qty" type="number" min="0"></div>
    </div>
    <button class="btn btn-ghost btn-sm" onclick="addRecipeIngredient()">Add ingredient</button>

    <div style="display:flex;gap:8px;margin-top:14px">
      <button class="btn btn-danger" onclick="deleteRecipe('${id}')">Delete recipe</button>
    </div>
  `);
}

function updateRecipeField(field, value) {
  const r = recipes.find((x) => x.id === currentRecipeId);
  if (!r) return;
  if (field === "price") r.target_sell_price = value ? Number(value) : null;
  if (field === "fee") r.platform_fee_pct = Number(value) || 0;
  saveAll();
}

function addRecipeIngredient() {
  const r = recipes.find((x) => x.id === currentRecipeId);
  if (!r) return;
  const ingId = document.getElementById("f-add-ing").value;
  const qty = Number(document.getElementById("f-add-qty").value);
  if (!ingId || !(qty > 0)) return showToast("Pick an ingredient and quantity", true);

  const existing = r.ingredients.find((ri) => ri.ingredient_id === ingId);
  if (existing) existing.qty_used = qty;
  else r.ingredients.push({ ingredient_id: ingId, qty_used: qty });

  saveAll();
  openRecipeDetail(currentRecipeId);
}

function removeRecipeIngredient(ingId) {
  const r = recipes.find((x) => x.id === currentRecipeId);
  if (!r) return;
  r.ingredients = r.ingredients.filter((ri) => ri.ingredient_id !== ingId);
  saveAll();
  openRecipeDetail(currentRecipeId);
}

function deleteRecipe(id) {
  if (!confirm("Delete this recipe? This cannot be undone.")) return;
  recipes = recipes.filter((x) => x.id !== id);
  saveAll();
  closeModal();
  showToast("Recipe deleted");
  render_recipes();
}
