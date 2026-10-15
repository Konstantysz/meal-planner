const WORDS: Partial<Record<Intl.LDMLPluralRule, string>> = { one: 'porcja', few: 'porcje' };
const rules = new Intl.PluralRules('pl');

/** „1 porcja", „2 porcje", „5 porcji", „12 porcji", „22 porcje": Polish plural of a serving count. */
export function servingsLabel(n: number): string {
  return `${n} ${WORDS[rules.select(n)] ?? 'porcji'}`;
}
