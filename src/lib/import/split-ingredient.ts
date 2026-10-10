import { QTY_SRC, SHAREABLE_UNITS } from './ingredient-text';

export interface IngredientPart {
  text: string;
  /** The line's label ("dodatki:", "do podania ewentualnie:") already says it is optional. */
  optional: boolean;
}

const LABEL_RE = /^([\p{L} ]{1,30}):\s*(.+)$/u;
const OPTIONAL_LABEL_RE = /dodatki|do podania|ewentualnie/i;
// "chili i kumin po 1/4 łyżeczki"
const TRAILING_PO_RE = new RegExp(`^(.+?)\\s+i\\s+(.+?)\\s+po\\s+(${QTY_SRC})\\s*$`, 'iu');
// "po pół łyżeczki papryki i oregano"
const LEADING_PO_RE = new RegExp(`^po\\s+(${QTY_SRC})\\s+(.+?)\\s+i\\s+(.+)$`, 'iu');
// "szczypta soli i pieprzu"
const SHARED_APPROX_RE = new RegExp(
  `^((?:\\d+(?:[.,]\\d+)?\\s*)?(?:${SHAREABLE_UNITS.join('|')}))\\s+(.+?)\\s+i\\s+(.+)$`,
  'iu',
);
// " i " followed by a new amount: "1 łyżeczka soli i 1/3 łyżeczki pieprzu", "łyżka soli i szczypta pieprzu"
const AND_AMOUNT_RE = new RegExp(`\\s+i\\s+(?=\\d|${QTY_SRC})`, 'iu');

/** Splits `text` on commas and semicolons that sit outside parentheses. */
function splitOutsideParens(text: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    else if ((ch === ',' || ch === ';') && depth === 0) {
      out.push(text.slice(start, i));
      start = i + 1;
    }
  }
  out.push(text.slice(start));
  return out.map((s) => s.trim()).filter(Boolean);
}

// One piece that may name several ingredients sharing one amount; returns the single-ingredient texts.
function splitShared(piece: string): string[] {
  const trailing = piece.match(TRAILING_PO_RE);
  if (trailing) return [trailing[1], trailing[2]].map((name) => `${trailing[3]} ${name}`);
  const leading = piece.match(LEADING_PO_RE);
  if (leading) return [leading[2], leading[3]].map((name) => `${leading[1]} ${name}`);
  const approx = piece.match(SHARED_APPROX_RE);
  if (approx) return [approx[2], approx[3]].map((name) => `${approx[1]} ${name}`);
  return [piece];
}

/** Stage 1: one raw line becomes one or more single-ingredient texts. */
export function splitIngredientLine(raw: string): IngredientPart[] {
  const label = raw.match(LABEL_RE);
  if (!label) return splitShared(raw.trim()).map((text) => ({ text, optional: false }));

  const optional = OPTIONAL_LABEL_RE.test(label[1]);
  return splitOutsideParens(label[2])
    .flatMap((piece) => piece.split(AND_AMOUNT_RE).flatMap(splitShared))
    .map((text) => ({ text, optional }));
}
