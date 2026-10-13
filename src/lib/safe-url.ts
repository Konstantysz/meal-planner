/** True for absolute http(s) URLs only; rejects javascript:, data: and the like. */
export function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

/** The URL when it is safe to put in an `href`, otherwise null. */
export function safeHttpUrl(value: string | null | undefined): string | null {
  return value && isHttpUrl(value) ? value : null;
}
