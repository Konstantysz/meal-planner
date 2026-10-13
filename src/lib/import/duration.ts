const ISO_DURATION = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i;

/** ISO 8601 duration ("PT20M", "PT1H30M") → whole minutes. Absent, unparsable or zero → null. */
export function parsePrepMinutes(iso: string | undefined): number | null {
  const m = iso?.trim().match(ISO_DURATION);
  if (!m) return null;
  const [days, hours, minutes, seconds] = [m[1], m[2], m[3], m[4]].map((p) => Number(p ?? 0));
  const total = Math.round(days * 1440 + hours * 60 + minutes + seconds / 60);
  return total > 0 ? total : null;
}
