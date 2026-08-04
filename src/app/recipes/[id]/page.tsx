import { notFound } from "next/navigation";
import { getRecipeDetail } from "@/lib/data/recipes";
import { getIngredientOptions } from "@/lib/data/ingredients";
import { RecipeEditor } from "./recipe-editor";

export default async function RecipeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [detail, ingredientOptions] = await Promise.all([
    getRecipeDetail(id),
    getIngredientOptions(),
  ]);

  if (!detail) notFound();

  return (
    <RecipeEditor
      recipe={detail.recipe}
      ingredients={detail.ingredients}
      packaging={detail.packaging}
      sopSteps={detail.sopSteps}
      ingredientOptions={ingredientOptions}
    />
  );
}
