import { describe, it, expect } from 'vitest';
import { matchEntry, nameHit } from '@/lib/import/eval-score';
import { UNITS } from '@/lib/import/unit';
import { SYSTEM_PROMPT } from '@/lib/import/schema';
import { CORPUS } from '../../fixtures/ingredient-corpus';

const got = (name: string, amount: number | null, unit: string | null) => ({ name, amount, unit, optional: false });

describe('nameHit', () => {
  it('accepts a base form for an inflected corpus name', () => {
    expect(nameHit('soli', 'sól')).toBe(true);
    expect(nameHit('czosnku', 'czosnek')).toBe(true);
  });
  it('accepts a shorter output name that is contained in the expected one', () => {
    expect(nameHit('boczku surowego wędzonego', 'boczek')).toBe(true);
  });
  it('rejects unrelated words', () => {
    expect(nameHit('soli', 'woda')).toBe(false);
  });
  it('is permissive on a bare 3-letter stem; matchEntry ranks around it', () => {
    expect(nameHit('pieprzu', 'pierś z kurczaka')).toBe(true);
  });
});

describe('matchEntry', () => {
  it('prefers the entry with a real word match over a bare 3-letter stem', () => {
    const pool = [got('pierś z kurczaka', 400, 'g'), got('pieprz', 1, 'szczypta')];
    const r = matchEntry({ name: 'pieprzu', amount: 1, unit: 'szczypta' }, pool);
    expect(r.hit?.name).toBe('pieprz');
    expect(r).toMatchObject({ amount: true, unit: true });
  });

  it('uses each output entry once: two expected onions need two output onions', () => {
    const first = matchEntry({ name: 'cebula', amount: 160, unit: 'g' }, [got('cebula', 160, 'g')]);
    const second = matchEntry({ name: 'cebula', amount: 200, unit: 'g' }, first.rest);
    expect(first.hit).toBeDefined();
    expect(second.hit).toBeUndefined();
  });

  it('does not mutate the pool it is given', () => {
    const pool = [got('sól', 1, 'szczypta')];
    matchEntry({ name: 'soli', amount: 1, unit: 'szczypta' }, pool);
    expect(pool).toHaveLength(1);
  });

  it('flags a wrong amount and a wrong unit separately', () => {
    const r = matchEntry({ name: 'soli', amount: 1, unit: 'łyżeczka' }, [got('sól', 2, 'łyżka')]);
    expect(r).toMatchObject({ name: true, amount: false, unit: false });
  });

  it('treats a missing amount as expected null', () => {
    const r = matchEntry({ name: 'parmezan', amount: null, unit: null }, [got('parmezan', null, null)]);
    expect(r).toMatchObject({ amount: true, unit: true });
  });

  it('reports a miss when no output name matches', () => {
    const r = matchEntry({ name: 'soli', amount: 1, unit: 'szczypta' }, [got('woda', 1, 'l')]);
    expect(r.hit).toBeUndefined();
  });
});

describe('corpus, prompt and UNITS agree', () => {
  const known = new Set<string>(UNITS);

  it('every corpus unit is one the app stores', () => {
    const used = new Set(
      Object.values(CORPUS)
        .flatMap((rows) => rows.flatMap(([, expected]) => expected))
        .flatMap((e) => (e.unit ? [e.unit] : [])),
    );
    expect([...used].filter((u) => !known.has(u))).toEqual([]);
  });

  it('every unit named in SYSTEM_PROMPT is one the app stores', () => {
    const line = /- unit: ([^;]+);/.exec(SYSTEM_PROMPT)?.[1];
    expect(line).toBeDefined();
    const named = line!.split(',').map((s) => s.trim());
    expect(named.filter((u) => !known.has(u))).toEqual([]);
  });
});
