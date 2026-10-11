// Every unit normalizeUnit can produce. Not used as a decoding-grammar enum: gemma2 then forces its
// intended word into the nearest allowed prefix ("płaska" -> "plaster", "pęczek"), silently wrong.
export const UNITS = [
  'g',
  'kg',
  'ml',
  'l',
  'łyżka',
  'łyżeczka',
  'szklanka',
  'szczypta',
  'garść',
  'ząbek',
  'sztuki',
  'opakowanie',
  'puszka',
  'pęczek',
  'gałązka',
  'ziarno',
  'plaster',
  'kawałek',
  'pętko',
] as const;

// Maps the many inflected forms a model may emit ("łyżek", "gramów") onto the units the app stores;
// anything else becomes null. The model wraps the unit in other words ("płaska łyżeczka", "łyżka stołowa"),
// so the last word that is a unit wins.
export function normalizeUnit(u: string): string | null {
  const words = u.toLowerCase().trim().split(/\s+/).reverse();
  return words.map(canonicalUnit).find((c) => c !== null) ?? null;
}

function canonicalUnit(lower: string): string | null {
  if (lower.startsWith('gram')) return 'g';
  if (lower.startsWith('litr')) return 'l';
  if (lower.startsWith('szt')) return 'sztuki';
  if (lower.startsWith('łyżecz')) return 'łyżeczka';
  if (/^łyż[kec]/.test(lower)) return 'łyżka';
  if (lower.startsWith('szklan')) return 'szklanka';
  if (lower.startsWith('ząb')) return 'ząbek';
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
  return (UNITS as readonly string[]).includes(lower) ? lower : null;
}
