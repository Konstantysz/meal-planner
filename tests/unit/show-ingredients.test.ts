import { describe, it, expect } from 'vitest';
import { ingredientSection } from '../../scripts/show-ingredients';

describe('ingredientSection', () => {
  it('keeps the list after a „Składniki" header and stops at the next heading', () => {
    const md = 'intro\n\n**Składniki**\n\n- 1 kg ziemniaków\n- 2 jajka\n\n## Burgery\n\nZiemniaki umyj.';
    expect(ingredientSection(md)).toBe('**Składniki**\n- 1 kg ziemniaków\n- 2 jajka');
  });

  it('keeps sub-lists introduced by bold headers', () => {
    const md = '**Składniki na placki**\n- a\n\n**Składniki na sos**\n- b\n\n## Krok 1';
    expect(ingredientSection(md)).toBe('**Składniki na placki**\n- a\n**Składniki na sos**\n- b');
  });

  it('stops at „Przygotowanie:" on pages without headings (jadłonomia)', () => {
    const md = 'Składniki na 4 porcje:\n500 g bobu\nsól\nPrzygotowanie:\n1. Ugotuj.';
    expect(ingredientSection(md)).toBe('Składniki na 4 porcje:\n500 g bobu\nsól');
  });

  it('reads a „### Składniki" heading as the start, not as the end', () => {
    const md = '### Składniki\n4 porcje\n- 600 g łososia\n\n### Przygotowanie\n1. Piecz.';
    expect(ingredientSection(md)).toBe('### Składniki\n4 porcje\n- 600 g łososia');
  });

  it('skips a tag list ("Składniki:" then "Danie:") and a mid-sentence mention', () => {
    const md =
      'Składniki:\nbób, cebula\nDanie:\ndania główne\nZupa wymaga trudniejszych składników.\nSkładniki na 4 porcje:\n500 g bobu\nPrzygotowanie:\n1. Ugotuj.';
    expect(ingredientSection(md)).toBe('Składniki na 4 porcje:\n500 g bobu');
  });

  it('caps the output so a page without a clear end cannot flood the context', () => {
    const md = 'Składniki\n' + Array.from({ length: 200 }, (_, i) => `- linia ${i}`).join('\n');
    expect(ingredientSection(md).split('\n').length).toBeLessThanOrEqual(60);
  });

  it('returns an empty string when the page has no ingredient header', () => {
    expect(ingredientSection('Tylko tekst.')).toBe('');
  });
});
