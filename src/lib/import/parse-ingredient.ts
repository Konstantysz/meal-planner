export interface ParsedIngredient {
  name: string;
  amount: number | null;
  unit: string | null;
}

const UNIT_WORDS = [
  'g',
  'kg',
  'ml',
  'l',
  'szt',
  'sztuki',
  'sztuka',
  'ząbki',
  'ząbków',
  'ząbek',
  'łyżeczki',
  'łyżeczka',
  'łyżki',
  'łyżka',
  'szklanki',
  'szklanka',
  'opakowanie',
  'opakowania',
];

// Shape words that may sit between amount and unit ("pół płaskiej łyżeczki").
const MODIFIER = '(?:\\s+(?:płask\\S*|czubat\\S*|gładk\\S*|kopiast\\S*))*';
const AMOUNT = '(\\d+(?:[.,]\\d+)?(?:\\s*\\/\\s*\\d+)?|pół|ćwierć|niecał\\S+)';
const unitRe = (units: string[], flags: string) => new RegExp(`${AMOUNT}${MODIFIER}\\s*(${units.join('|')})\\b`, flags);

const AMOUNT_UNIT_RE = unitRe(UNIT_WORDS, 'i');
const AMOUNT_UNIT_RE_ALL = unitRe(UNIT_WORDS, 'gi');
const METRIC_RE = unitRe(['g', 'kg', 'ml', 'l'], 'i');
// "6 średnich jajek", "250 cukru" — leading number with no unit word.
const BARE_COUNT_RE = /^(\d+(?:[.,]\d+)?)\s+(?:(?:bardzo|średni\S*|duż\S*|mał\S*)\s+)*/i;

// "chili i kumin po 1/4 łyżeczki" — two ingredient names sharing one trailing amount+unit.
const COMPOUND_RE = /^(.+?)\s+i\s+(.+?)\s+po\s+(.+)$/i;

// ponytail: keeps one amount+unit (a metric one if present, since macros are per 100 g,
// else the first) and strips every amount phrase and " - comment" tail from the name;
// not a full NLP parser. Bare leading counts: < 50 → sztuki, else grams.
export function parseIngredientLine(raw: string): ParsedIngredient {
  const match = raw.match(METRIC_RE) ?? raw.match(AMOUNT_UNIT_RE);
  let amount: number | null = null;
  let unit: string | null = null;
  let rest = raw;
  if (match) {
    amount = parseAmount(match[1]);
    unit = normalizeUnit(match[2]);
    rest = raw.replace(AMOUNT_UNIT_RE_ALL, ' ');
  } else {
    const bare = raw.trim().match(BARE_COUNT_RE);
    if (bare) {
      amount = parseAmount(bare[1]);
      unit = amount !== null && amount < 50 ? 'sztuki' : 'g';
      rest = raw.trim().slice(bare[0].length);
    }
  }
  const name = rest
    .replace(/\(\s*\)/g, ' ')
    .replace(/\s[-–].*$/, '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s,–-]+|[\s,–(-]+$/g, '');
  return { name: name || raw.trim(), amount, unit };
}

// Splits a compound line ("chili i kumin po 1/4 łyżeczki") into one ParsedIngredient
// per named ingredient, each getting the shared amount+unit. Falls back to a single
// result via parseIngredientLine when the line isn't in that "X i Y po <qty>" shape.
export function parseIngredientLines(raw: string): ParsedIngredient[] {
  const compound = raw.match(COMPOUND_RE);
  if (compound) {
    const [, first, second, rest] = compound;
    const { amount, unit } = parseIngredientLine(`_ ${rest}`);
    if (unit) {
      return [first, second].map((name) => ({ name: name.trim(), amount, unit }));
    }
  }
  return [parseIngredientLine(raw)];
}

function parseAmount(s: string): number | null {
  const lower = s.toLowerCase();
  if (lower === 'pół') return 0.5;
  if (lower === 'ćwierć') return 0.25;
  if (lower.startsWith('niecał')) return 1;
  if (s.includes('/')) {
    const [num, den] = s.split('/').map((x) => Number(x.trim()));
    return den ? num / den : null;
  }
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
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

function normalizeUnit(u: string): string {
  const lower = u.toLowerCase();
  if (lower.startsWith('szt')) return 'sztuki';
  if (lower.startsWith('łyżeczk')) return 'łyżeczka';
  if (lower.startsWith('łyżk')) return 'łyżka';
  if (lower.startsWith('szklank')) return 'szklanka';
  if (lower.startsWith('ząbk') || lower === 'ząbek') return 'ząbek';
  if (lower.startsWith('opakowani')) return 'opakowanie';
  return lower;
}
