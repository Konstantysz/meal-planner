export type Visibility = 'private' | 'household' | 'public_link';
export type DietTag = 'wegetarianska' | 'ketogeniczna' | 'bezglutenowa';
export type Allergen = 'gluten' | 'mieso' | 'nabial' | 'orzechy' | 'ryby';
export type MacroSource = 'off' | 'manual' | 'ai_estimate';
export type IngredientCategory =
  | 'warzywa' | 'owoce' | 'mieso' | 'ryby' | 'nabial' | 'pieczywo'
  | 'makarony' | 'przyprawy' | 'tluszcze' | 'napoje' | 'inne';

export interface Macros {
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
}

export interface Ingredient {
  id: string;
  name: string;
  category: IngredientCategory;
  kcal_per_100g: number | null;
  protein_per_100g: number | null;
  fat_per_100g: number | null;
  carbs_per_100g: number | null;
  default_unit: string | null;
  source: MacroSource;
}

export interface RecipeIngredient {
  id: string;
  recipe_id: string;
  ingredient_id: string;
  amount: number | null;
  unit: string | null;
  raw_text: string;
  position: number;
}

export interface RecipeStep {
  id: string;
  recipe_id: string;
  position: number;
  text: string;
}

export interface Recipe {
  id: string;
  household_id: string;
  author_id: string;
  name: string;
  servings_base: number;
  prep_time_min: number | null;
  source_url: string | null;
  visibility: Visibility;
  diet_tags: DietTag[];
  allergens: Allergen[];
  created_at: string;
}

export interface Plan {
  id: string;
  household_id: string;
  week_start_date: string;
}

export interface PlanSlot {
  id: string;
  plan_id: string;
  date: string;
  position: number;
  label: string | null;
  recipe_id: string | null;
  servings: number;
}

export interface ShoppingItem {
  ingredient_id: string;
  ingredient_name: string;
  category: IngredientCategory;
  unit: string | null;
  total_amount: number | null;
  raw_amounts: string[];
  have_it: boolean;
  incomplete: boolean;
}
