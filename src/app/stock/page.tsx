import { getIngredientsWithLastPurchase } from "@/lib/data/ingredients";
import { IngredientRow } from "./ingredient-row";
import { AddIngredientButton } from "./add-ingredient-button";

export default async function StockPage() {
  const ingredients = await getIngredientsWithLastPurchase();

  return (
    <div className="space-y-4">
      <AddIngredientButton />

      {ingredients.length === 0 ? (
        <p className="py-8 text-center text-sm text-text-secondary">
          No ingredients yet. Add your first one above.
        </p>
      ) : (
        <ul className="rounded-2xl border border-border bg-surface px-4 shadow-sm">
          {ingredients.map((ingredient) => (
            <IngredientRow key={ingredient.id} ingredient={ingredient} />
          ))}
        </ul>
      )}
    </div>
  );
}
