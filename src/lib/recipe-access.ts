import type { Recipe } from '@/lib/types';

/**
 * Whether a user may change or delete a recipe in place: its saving member (`author_id`) or an
 * app admin, as rec_update / rec_delete allow since migration 0014. Anyone else edits a fork.
 * This only picks the UI path; RLS enforces the rule.
 */
export function canEditRecipe(recipe: Pick<Recipe, 'author_id'>, userId: string | null, isAdmin: boolean): boolean {
  return isAdmin || (userId !== null && recipe.author_id === userId);
}
