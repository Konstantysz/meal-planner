import {
  AMOUNT_UNIT_RE,
  AMOUNT_UNIT_RE_ALL,
  IMPLIED_RE,
  IMPLIED_RE_ALL,
  LEADING_COUNT_RE,
  METRIC_RE,
  SHAPE_ADJ,
  normalizeText,
  normalizeUnit,
  parseAmount,
} from './ingredient-text';
import { splitIngredientLine } from './split-ingredient';

export interface ParsedIngredient {
  name: string;
  amount: number | null;
  unit: string | null;
  /** Set only when true. */
  optional?: boolean;
}

interface Quantity {
  amount: number | null;
  unit: string | null;
}

const OPTIONAL_RE = /możn[ae] pominąć|ewentualnie/i;
const WATER_RE = /^wod[aęy](?![\p{L}])/iu;
// Size/filler words that never belong to the ingredient name.
const FILLER_RE = new RegExp(
  `(?<![\\p{L}])(?:duż|mał|większ|mniejsz|spor|ulubion|średni)(?:ej|ego|ych|ymi|ym|ch|[aeyąo])?(?![\\p{L}])`,
  'giu',
);

// Stage 2: metric amount anywhere (macros are per 100 g), else the first amount+unit, else a bare
// leading count (< 50 → sztuki, else grams), else an approximate unit with no number (→ 1).
function extractQuantity(text: string): Quantity {
  const match = text.match(METRIC_RE) ?? text.match(AMOUNT_UNIT_RE);
  if (match) return { amount: parseAmount(match[1]), unit: normalizeUnit(match[2]) };
  const bare = text.trim().match(LEADING_COUNT_RE);
  if (bare) {
    const amount = parseAmount(bare[0].trim());
    return { amount, unit: amount !== null && amount < 50 ? 'sztuki' : 'g' };
  }
  const implied = text.match(IMPLIED_RE);
  return implied ? { amount: 1, unit: normalizeUnit(implied[1]) } : { amount: null, unit: null };
}

// Stage 3 (per alternative): strips every amount phrase, fillers and decorations from one name.
function stripName(alt: string): string {
  return alt
    .replace(AMOUNT_UNIT_RE_ALL, ' ')
    .replace(IMPLIED_RE_ALL, ' ')
    .replace(new RegExp(`(?<![\\p{L}])${SHAPE_ADJ}(?![\\p{L}])`, 'giu'), ' ')
    .replace(FILLER_RE, ' ')
    .replace(/(?<![\p{L}])(?:po|ewentualnie|możn[ae] pominąć)(?![\p{L}])/giu, ' ')
    .trim()
    .replace(LEADING_COUNT_RE, '')
    .replace(/\*+/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s,–-]+|[\s,–(+-]+$/g, '')
    .replace(/\.{2,}$/, '')
    .trim();
}

// Stage 3: cut tails and asides, then keep the first " lub " alternative that isn't water.
function extractName(text: string): { name: string; water: boolean } {
  const base = text
    .replace(/\([^)]*\)/g, ' ')
    .replace(/"[^"]*"|„[^”]*”/g, ' ')
    .replace(/\s[-–—].*$/, '')
    .replace(/(?<![\p{L}])np\..*$/iu, '');
  const alternatives = stripName(base)
    .split(/\s+lub\s+/i)
    .map((alt) => alt.trim())
    .filter(Boolean);
  const kept = alternatives.find((alt) => !WATER_RE.test(alt));
  if (kept) return { name: kept, water: false };
  return { name: alternatives[0] ?? '', water: alternatives.length > 0 };
}

function parsePart(raw: string): { parsed: ParsedIngredient; water: boolean } {
  const text = normalizeText(raw);
  const { name, water } = extractName(text);
  const parsed: ParsedIngredient = { name: name || raw.trim(), ...extractQuantity(text) };
  // Stage 4: flags.
  if (OPTIONAL_RE.test(text)) parsed.optional = true;
  return { parsed, water };
}

// ponytail: staged heuristics (split → quantity → name → flags → water), not an NLP parser;
// a new edge case belongs to exactly one stage, plus a line in tests/unit/import/ingredient-corpus.test.ts.
export function parseIngredientLine(raw: string): ParsedIngredient {
  return parsePart(raw).parsed;
}

// One raw line → one ParsedIngredient per named ingredient. Water-only parts are dropped (stage 5).
export function parseIngredientLines(raw: string): ParsedIngredient[] {
  return splitIngredientLine(normalizeText(raw)).flatMap(({ text, optional }) => {
    const { parsed, water } = parsePart(text);
    if (water) return [];
    return [optional ? { ...parsed, optional: true } : parsed];
  });
}

// Strips "np. X" (e.g. suggestions) and parenthetical asides that add noise —
// used both as the external search query and as the name stored for new ingredients.
export function cleanIngredientName(name: string): string {
  return name
    .replace(/\bnp\.\s*\S+.*/i, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
