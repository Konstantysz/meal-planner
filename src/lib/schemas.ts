import { z } from 'zod';

export const RecipeJsonLdSchema = z.object({
  name: z.string().min(1),
  recipeIngredient: z.array(z.string()).default([]),
  recipeInstructions: z.union([
    z.string(),
    z.array(z.string()),
    z.array(z.object({ text: z.string() })),
  ]).default([]),
  recipeYield: z.union([z.string(), z.number()]).optional(),
  prepTime: z.string().optional(),
  cookTime: z.string().optional(),
  totalTime: z.string().optional(),
  image: z.union([z.string(), z.array(z.string())]).optional(),
});

export const IngredientInputSchema = z.object({
  name: z.string().min(1).max(200),
  category: z.enum([
    'warzywa','owoce','mieso','ryby','nabial','pieczywo',
    'makarony','przyprawy','tluszcze','napoje','inne',
  ]),
  kcal_per_100g: z.number().nonnegative().nullable(),
  protein_per_100g: z.number().nonnegative().nullable(),
  fat_per_100g: z.number().nonnegative().nullable(),
  carbs_per_100g: z.number().nonnegative().nullable(),
  default_unit: z.string().nullable(),
  source: z.enum(['off', 'manual', 'ai_estimate']),
});

export const RecipeIngredientInputSchema = z.object({
  ingredient_id: z.string().uuid(),
  amount: z.number().nonnegative().nullable(),
  unit: z.string().nullable(),
  raw_text: z.string().min(1),
  position: z.number().int().nonnegative(),
});

export const RecipeInputSchema = z.object({
  name: z.string().min(1).max(200),
  servings_base: z.number().int().positive(),
  prep_time_min: z.number().int().nonnegative().nullable(),
  source_url: z.string().url().nullable(),
  visibility: z.enum(['private', 'household', 'public_link']).default('household'),
  diet_tags: z.array(z.enum(['wegetarianska','ketogeniczna','bezglutenowa'])).default([]),
  allergens: z.array(z.enum(['gluten','mieso','nabial','orzechy','ryby'])).default([]),
  ingredients: z.array(RecipeIngredientInputSchema).min(1),
  steps: z.array(z.object({ position: z.number().int(), text: z.string().min(1) })).min(1),
});

export const PlanSlotInputSchema = z.object({
  plan_id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  position: z.number().int().nonnegative(),
  label: z.string().max(50).nullable(),
  recipe_id: z.string().uuid().nullable(),
  servings: z.number().positive(),
});

export type RecipeJsonLd = z.infer<typeof RecipeJsonLdSchema>;
export type RecipeInput = z.infer<typeof RecipeInputSchema>;
export type IngredientInput = z.infer<typeof IngredientInputSchema>;
export type PlanSlotInput = z.infer<typeof PlanSlotInputSchema>;
