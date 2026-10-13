/**
 * Hosts a recipe photo may be hotlinked from (recipes.image_url). One list for three uses: the
 * `images.remotePatterns` in next.config.ts, the RecipeInputSchema check, and the import's
 * og:image filter. Adding a source site means adding its image host here.
 * No imports: next.config.ts loads this file.
 */
export const IMAGE_HOSTS = [
  'jadlonomia.com',
  'www.jadlonomia.com',
  'aniagotuje.pl',
  'www.aniagotuje.pl',
  'aniagotuje.com',
  'cdn.aniagotuje.com',
] as const;

/** True for an https URL on one of IMAGE_HOSTS. Anything unparsable is false. */
export function isAllowedImageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && (IMAGE_HOSTS as readonly string[]).includes(url.hostname);
  } catch {
    return false;
  }
}
