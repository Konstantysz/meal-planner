// Maps the many inflected forms a model may emit ("łyżek", "gramów") onto the units the app stores.
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
