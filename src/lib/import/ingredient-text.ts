// Shared vocabulary and low-level text helpers for the ingredient parser stages
// (split-ingredient.ts, parse-ingredient.ts).

// Units with no real weight: macros skip them, the shopping list keeps them as their own unit.
const APPROX_UNITS = [
  'szczypta',
  'szczypty',
  'szczyptę',
  'szczypcie',
  'gałązka',
  'gałązki',
  'gałązek',
  'garść',
  'garści',
  'pęczek',
  'pęczki',
  'pęczków',
  'puszka',
  'puszki',
  'puszek',
  'plaster',
  'plastry',
  'plasterków',
  'plasterek',
  'kawałek',
  'kawałki',
  'kawałków',
  'pętko',
  'pętka',
  'pętek',
  'ziarno',
  'ziarna',
  'ziaren',
];

const METRIC_UNITS = ['g', 'gram', 'gramy', 'gramów', 'kg', 'ml', 'l', 'litr', 'litra', 'litry', 'litrów'];

const UNIT_WORDS = [
  ...METRIC_UNITS,
  'szt',
  'sztuki',
  'sztuka',
  'ząbki',
  'ząbków',
  'ząbek',
  'łyżeczki',
  'łyżeczka',
  'łyżeczek',
  'łyżeczce',
  'łyżki',
  'łyżka',
  'łyżek',
  'łyżce',
  'szklanki',
  'szklanka',
  'szklanek',
  'opakowanie',
  'opakowania',
  ...APPROX_UNITS,
];

// Unit words that may stand alone ("łyżka cukru", "po sporej szczypcie"): nominative, accusative and
// locative only, so "z puszki" or "łyżki" inside a name never counts as an implied amount of 1.
const IMPLIED_UNITS = [
  'szczypta',
  'szczyptę',
  'szczypcie',
  'garść',
  'pęczek',
  'gałązka',
  'łyżka',
  'łyżkę',
  'łyżce',
  'łyżeczka',
  'łyżeczkę',
  'łyżeczce',
  'szklanka',
  'szklankę',
  'szklance',
  'puszka',
  'puszkę',
  'kawałek',
  'pętko',
];

// Units that can be shared by several names ("szczypta soli i pieprzu").
export const SHAREABLE_UNITS = ['szczypta', 'garść', 'pęczek', 'gałązka'];

const NUM = String.raw`\d+(?:[.,]\d+)?(?:\s*\/\s*\d+)?`;
// Up to 2 adjective-like words between amount and unit ("2 małe ząbki", "pół łaskiej łyżeczki").
const ADJ = String.raw`\p{L}+(?:ej|ego|e|a|ie)`;
const MOD = String.raw`(?:\s+${ADJ}){0,2}`;
export const SHAPE_ADJ = String.raw`(?:płask|czubat|gładk|kopiast)\p{L}*`;

const alt = (words: string[]) => [...words].sort((a, b) => b.length - a.length).join('|');
// (?![\p{L}\d]) with the u flag rather than \b: \b is ASCII-only, so "szczyptę"/"garść" would never match.
const END = String.raw`(?![\p{L}\d])`;
const START = String.raw`(?<![\p{L}\d])`;

/** Source of "<amount> [adjectives] <unit>"; capture=true exposes groups 1 (amount) and 2 (unit). */
function amountUnitSrc(units: string[], capture: boolean): string {
  const [o, c] = capture ? ['(', ')'] : ['(?:', ')'];
  return String.raw`(?<![\d.,/])${o}${NUM}${c}${MOD}\s*${o}${alt(units)}${c}${END}`;
}

export const AMOUNT_UNIT_RE = new RegExp(amountUnitSrc(UNIT_WORDS, true), 'iu');
export const AMOUNT_UNIT_RE_ALL = new RegExp(AMOUNT_UNIT_RE, 'giu');
export const METRIC_RE = new RegExp(amountUnitSrc(METRIC_UNITS, true), 'iu');
export const AMOUNT_UNIT_SRC = amountUnitSrc(UNIT_WORDS, false);

const IMPLIED_SRC = String.raw`${START}(?:${SHAPE_ADJ}\s+)?(${alt(IMPLIED_UNITS)})${END}`;
export const IMPLIED_RE = new RegExp(IMPLIED_SRC, 'iu');
export const IMPLIED_RE_ALL = new RegExp(IMPLIED_RE, 'giu');
// A shared quantity ("0.5 płaskiej łyżeczki", "sporej szczypcie") as used after "po".
export const QTY_SRC = String.raw`(?:${AMOUNT_UNIT_SRC}|(?:\p{L}+(?:ej|e|a)\s+)?(?:${alt(IMPLIED_UNITS)})${END})`;
export const LEADING_COUNT_RE = /^\d+(?:[.,]\d+)?(?![\d/])\s*/;

const WORD_AMOUNTS: Record<string, string> = {
  'jedna czwarta': '1/4',
  'jedna trzecia': '1/3',
  'dwie trzecie': '2/3',
  'trzy czwarte': '3/4',
  ćwierć: '0.25',
  półtora: '1.5',
  półtorej: '1.5',
  pół: '0.5',
  jeden: '1',
  jedna: '1',
  jedno: '1',
  dwa: '2',
  dwie: '2',
  trzy: '3',
  kilka: '3',
  kilku: '3',
  parę: '2',
};
const WORD_AMOUNT_RE = new RegExp(`${START}(${alt(Object.keys(WORD_AMOUNTS))})${END}`, 'giu');

const UNICODE_FRACTIONS: Record<string, string> = { '½': '1/2', '¼': '1/4', '¾': '3/4', '⅓': '1/3', '⅔': '2/3' };
const num = (s: string) => Number(s.replace(',', '.'));

// Rewrites every spelled-out amount form into plain digits so the quantity and name stages only see
// numbers: fractions, mixed numbers, "2 x 5", ranges (upper bound wins) and Polish number words.
export function normalizeText(text: string): string {
  return text
    .replace(/(\d)\s*([½¼¾⅓⅔])/g, (_, n: string, f: string) => `${n} ${UNICODE_FRACTIONS[f]}`)
    .replace(/[½¼¾⅓⅔]/g, (f) => UNICODE_FRACTIONS[f])
    .replace(/(?<![\d.,/])(\d+)\s+(?:i\s+)?(\d+)\/(\d+)(?!\d)/g, (m, w: string, n: string, d: string) =>
      Number(d) ? String(Number(w) + Number(n) / Number(d)) : m,
    )
    .replace(/(?<![\d.,/])(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)(?![\d/])/g, (_, a: string, b: string) =>
      String(num(a) * num(b)),
    )
    .replace(/(?<![\d.,/])\d+(?:[.,]\d+)?-(\d+(?:[.,]\d+)?)(?![\d/])/g, '$1')
    .replace(new RegExp(`${START}niecał\\p{L}*\\s+`, 'giu'), '')
    .replace(WORD_AMOUNT_RE, (w) => WORD_AMOUNTS[w.toLowerCase()]);
}

export function parseAmount(s: string): number | null {
  if (s.includes('/')) {
    const [n, d] = s.split('/').map((x) => num(x.trim()));
    return d ? n / d : null;
  }
  const n = num(s);
  return Number.isFinite(n) ? n : null;
}

export function normalizeUnit(u: string): string {
  const lower = u.toLowerCase();
  if (lower.startsWith('gram')) return 'g';
  if (lower.startsWith('litr')) return 'l';
  if (lower.startsWith('szt')) return 'sztuki';
  if (lower.startsWith('łyżecz')) return 'łyżeczka';
  if (/^łyż[kec]/.test(lower)) return 'łyżka';
  if (lower.startsWith('szklan')) return 'szklanka';
  if (lower.startsWith('ząbk') || lower === 'ząbek') return 'ząbek';
  if (lower.startsWith('opakowani')) return 'opakowanie';
  if (lower.startsWith('szczyp')) return 'szczypta';
  if (lower.startsWith('gałąz')) return 'gałązka';
  if (lower.startsWith('garś')) return 'garść';
  if (lower.startsWith('pęcz')) return 'pęczek';
  if (lower.startsWith('ziar')) return 'ziarno';
  if (lower.startsWith('puszk') || lower.startsWith('puszek')) return 'puszka';
  if (lower.startsWith('plaster')) return 'plaster';
  if (lower.startsWith('kawał')) return 'kawałek';
  if (lower.startsWith('pętk') || lower.startsWith('pętek')) return 'pętko';
  return lower;
}
