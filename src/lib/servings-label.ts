/** „1 porcja", „2 porcje", „5 porcji", „12 porcji", „22 porcje": Polish plural of a serving count. */
export function servingsLabel(n: number): string {
  const lastTwo = n % 100;
  const last = n % 10;
  const word = n === 1 ? 'porcja' : last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14) ? 'porcje' : 'porcji';
  return `${n} ${word}`;
}
