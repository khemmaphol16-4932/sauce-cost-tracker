import Link from "next/link";
import { getRecipes } from "@/lib/data/recipes";
import { NewRecipeButton } from "./new-recipe-button";

export default async function RecipesPage() {
  const recipes = await getRecipes();

  return (
    <div className="space-y-4">
      <NewRecipeButton />

      {recipes.length === 0 ? (
        <p className="py-8 text-center text-sm text-text-secondary">
          No recipes yet. Create your first one above.
        </p>
      ) : (
        <ul className="rounded-2xl border border-border bg-surface px-4 shadow-sm">
          {recipes.map((r) => (
            <li key={r.id} className="border-b border-border py-3 last:border-0">
              <Link href={`/recipes/${r.id}`} className="block">
                <p className="font-medium text-text">{r.name}</p>
                <p className="mt-0.5 text-xs text-text-secondary">
                  {r.bottle_size_ml} ml bottle
                  {r.target_sell_price != null && <> · target ฿{r.target_sell_price}</>}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
