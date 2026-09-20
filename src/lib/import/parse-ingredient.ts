export interface ParsedIngredient {
  name: string;
  amount: number | null;
  unit: string | null;
}

const UNIT_WORDS = [
  'g', 'kg', 'ml', 'l', 'szt', 'sztuki', 'sztuka', 'ząbki', 'ząbków', 'ząbek',
  'łyżeczki', 'łyżeczka', 'łyżki', 'łyżka', 'szklanki', 'szklanka', 'opakowanie', 'opakowania',
];

const AMOUNT_UNIT_RE = new RegExp(
  `(\\d+(?:[.,]\\d+)?(?:\\s*\\/\\s*\\d+)?|pół|ćwierć)\\s*(${UNIT_WORDS.join('|')})\\b`,
  'i'
);

// "chili i kumin po 1/4 łyżeczki" — two ingredient names sharing one trailing amount+unit.
const COMPOUND_RE = /^(.+?)\s+i\s+(.+?)\s+po\s+(.+)$/i;

// ponytail: takes the first amount+unit found and strips it out; a multi-quantity
// line ("papryka ... 400 g - 2 sztuki") keeps only the first match — good enough
// for review-and-fix UX, not a full NLP parser.
export function parseIngredientLine(raw: string): ParsedIngredient {
  const match = raw.match(AMOUNT_UNIT_RE);
  if (!match) {
    return { name: raw.trim(), amount: null, unit: null };
  }
  const amount = parseAmount(match[1]);
  const unit = normalizeUnit(match[2]);
  const name = raw.slice(0, match.index).replace(/[-–,]\s*$/, '').trim() || raw.trim();
  return { name, amount, unit };
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
