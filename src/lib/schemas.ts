import { z } from 'zod';
import { normalizeWeekStart } from '@/lib/week';
import { isAllowedImageUrl } from '@/lib/image-hosts';
import { MACRO_LIMITS, validateMacros, type MacroIssue } from '@/lib/macro-validation';

export const RecipeJsonLdSchema = z.object({
  name: z.string().min(1),
  recipeIngredient: z.array(z.string()).default([]),
  recipeInstructions: z.union([z.string(), z.array(z.string()), z.array(z.object({ text: z.string() }))]).default([]),
  recipeYield: z.union([z.string(), z.number()]).optional(),
  prepTime: z.string().optional(),
  cookTime: z.string().optional(),
  totalTime: z.string().optional(),
  image: z.union([z.string(), z.array(z.string())]).optional(),
});

/** Field and English message for each range rule; `macro_sum` spans three fields, so it has no path. */
const MACRO_ISSUE_DETAILS: Record<Exclude<MacroIssue, 'atwater'>, { path: string[]; message: string }> = {
  kcal_range: {
    path: ['kcal_per_100g'],
    message: `kcal_per_100g must be between 0 and ${MACRO_LIMITS.maxKcal}`,
  },
  protein_range: {
    path: ['protein_per_100g'],
    message: `protein_per_100g must be between 0 and ${MACRO_LIMITS.maxGrams}`,
  },
  fat_range: { path: ['fat_per_100g'], message: `fat_per_100g must be between 0 and ${MACRO_LIMITS.maxGrams}` },
  carbs_range: {
    path: ['carbs_per_100g'],
    message: `carbs_per_100g must be between 0 and ${MACRO_LIMITS.maxGrams}`,
  },
  macro_sum: {
    path: [],
    message: `protein_per_100g + fat_per_100g + carbs_per_100g must be at most ${MACRO_LIMITS.maxSum}`,
  },
};

export const IngredientInputSchema = z
  .object({
    name: z.string().min(1).max(200),
    category: z.enum([
      'warzywa',
      'owoce',
      'mieso',
      'ryby',
      'nabial',
      'pieczywo',
      'makarony',
      'przyprawy',
      'tluszcze',
      'napoje',
      'inne',
    ]),
    kcal_per_100g: z.number().nonnegative().nullable(),
    protein_per_100g: z.number().nonnegative().nullable(),
    fat_per_100g: z.number().nonnegative().nullable(),
    carbs_per_100g: z.number().nonnegative().nullable(),
    default_unit: z.string().nullable(),
    source: z.enum(['off', 'manual', 'ai_estimate']),
  })
  // Range rules shared with the DB CHECK constraints (migration 0012). Atwater is not applied here.
  .superRefine((v, ctx) => {
    for (const issue of validateMacros(v)) {
      if (issue === 'atwater') continue; // not requested above; kept for exhaustiveness
      const { path, message } = MACRO_ISSUE_DETAILS[issue];
      ctx.addIssue({ code: 'custom', path, message });
    }
  });

export const RecipeIngredientInputSchema = z.object({
  ingredient_id: z.string().uuid(),
  amount: z.number().nonnegative().nullable(),
  unit: z.string().nullable(),
  raw_text: z.string().min(1),
  position: z.number().int().nonnegative(),
  optional: z.boolean().default(false),
});

/** Trimmed optional text (<= 200 chars); missing, null or blank becomes null. */
const BlankToNullSchema = z
  .string()
  .trim()
  .max(200)
  .transform((v) => (v === '' ? null : v))
  .nullable()
  .default(null);

/** Optional photo URL: blank or missing becomes null; otherwise an https URL on an allowed host. */
const ImageUrlSchema = z
  .string()
  .trim()
  .max(2048)
  .transform((v) => (v === '' ? null : v))
  .nullable()
  .default(null)
  .refine((v) => v === null || isAllowedImageUrl(v), { message: 'image host not allowed' })
  // new URL lowercases the scheme; the DB check `^https?://` is case-sensitive.
  .transform((v) => (v === null ? null : new URL(v).href));

export const RecipeInputSchema = z.object({
  name: z.string().min(1).max(200),
  servings_base: z.number().int().positive(),
  prep_time_min: z.number().int().nonnegative().nullable(),
  source_url: z.string().url().nullable(),
  source_author: BlankToNullSchema,
  image_url: ImageUrlSchema,
  visibility: z.enum(['private', 'household', 'public_link']).default('household'),
  diet_tags: z.array(z.enum(['wegetarianska', 'ketogeniczna', 'bezglutenowa'])).default([]),
  allergens: z.array(z.enum(['gluten', 'mieso', 'nabial', 'orzechy', 'ryby'])).default([]),
  ingredients: z.array(RecipeIngredientInputSchema).min(1),
  steps: z
    .array(
      z.object({
        position: z.number().int(),
        title: BlankToNullSchema,
        text: z.string().min(1),
      }),
    )
    .min(1),
});

export const PlanSlotInputSchema = z.object({
  plan_id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  position: z.number().int().nonnegative(),
  label: z.string().max(50).nullable(),
  recipe_id: z.string().uuid().nullable(),
  servings: z.number().positive(),
});

// Body of PATCH /api/plans/[id]/slots/[slotId]: move a slot and/or change its servings.
export const PlanSlotPatchSchema = z
  .object({
    date: z.string().refine((v) => normalizeWeekStart(v) !== null, { message: 'invalid calendar date' }),
    position: z.number().int().nonnegative(),
    servings: z.number().positive().max(99),
  })
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'date, position or servings required' });

// Shape returned by the get_shared_plan(token) RPC (migration 0005).
export const SharedPlanSchema = z.object({
  week_start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  slots: z.array(
    z.object({
      id: z.string().uuid(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      position: z.number().int().nonnegative(),
      label: z.string().nullable(),
      servings: z.number().positive(),
      recipe: z.object({ name: z.string() }).nullable(),
    }),
  ),
});

export type RecipeJsonLd = z.infer<typeof RecipeJsonLdSchema>;
export type SharedPlan = z.infer<typeof SharedPlanSchema>;
export type RecipeInput = z.infer<typeof RecipeInputSchema>;
export type IngredientInput = z.infer<typeof IngredientInputSchema>;
export type PlanSlotPatch = z.infer<typeof PlanSlotPatchSchema>;
export type PlanSlotInput = z.infer<typeof PlanSlotInputSchema>;
