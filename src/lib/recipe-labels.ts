import type { Allergen, DietTag } from './types';

/** Polish display names for the stored slugs (the slugs stay ASCII; see recipe-management). */
export const DIET_LABELS: Record<DietTag, string> = {
  wegetarianska: 'wegetariańska',
  ketogeniczna: 'ketogeniczna',
  bezglutenowa: 'bezglutenowa',
};

export const ALLERGEN_LABELS: Record<Allergen, string> = {
  gluten: 'gluten',
  mieso: 'mięso',
  nabial: 'nabiał',
  orzechy: 'orzechy',
  ryby: 'ryby',
};
