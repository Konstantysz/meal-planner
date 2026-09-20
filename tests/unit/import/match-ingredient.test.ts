import { describe, it, expect } from 'vitest';
import { findBestMatch } from '@/lib/import/match-ingredient';
import type { Ingredient } from '@/lib/types';

function ing(name: string): Ingredient {
  return {
    id: name, name, category: 'inne',
    kcal_per_100g: null, protein_per_100g: null, fat_per_100g: null, carbs_per_100g: null,
    default_unit: null, source: 'manual',
  };
}

describe('findBestMatch', () => {
  const base = [ing('cebula'), ing('papryka czerwona'), ing('czosnek'), ing('pomidor')];

  it('matches exact name (case-insensitive)', () => {
    expect(findBestMatch('Cebula', base)?.name).toBe('cebula');
  });

  it('matches substring', () => {
    expect(findBestMatch('cebula np. cukrowa', base)?.name).toBe('cebula');
  });

  it('matches by word overlap', () => {
    expect(findBestMatch('papryka świeża czerwona', base)?.name).toBe('papryka czerwona');
  });

  it('returns null when nothing matches well', () => {
    expect(findBestMatch('kiełbasa chorizo', base)).toBeNull();
  });

  it('returns null for empty query', () => {
    expect(findBestMatch('', base)).toBeNull();
  });

  it('returns null on empty ingredient list', () => {
    expect(findBestMatch('cebula', [])).toBeNull();
  });
});
