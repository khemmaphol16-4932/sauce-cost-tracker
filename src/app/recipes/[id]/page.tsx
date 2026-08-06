import { notFound } from "next/navigation";
import { getRecipeDetail } from "@/lib/data/recipes";
import { getIngredientOptions } from "@/lib/data/ingredients";
import { getSopTemplates } from "@/lib/data/sop-templates";
import { RecipeEditor } from "./recipe-editor";

export default async function RecipeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [detail, ingredientOptions, sopTemplates] = await Promise.all([
    getRecipeDetail(id),
    getIngredientOptions(),
    getSopTemplates(),
  ]);

  if (!detail) notFound();

  return (
    <RecipeEditor
      recipe={detail.recipe}
      ingredients={detail.ingredients}
      packaging={detail.packaging}
      sopSteps={detail.sopSteps}
      sopTemplates={sopTemplates}
      ingredientOptions={ingredientOptions}
    />
  );
}
