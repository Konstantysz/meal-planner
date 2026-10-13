import * as cheerio from 'cheerio';
import { isAllowedImageUrl } from '@/lib/image-hosts';

/** Reads the first string out of a JSON-LD `image` value: string, string[], ImageObject or ImageObject[]. */
function firstImage(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(firstImage).find((v) => v !== null) ?? null;
  if (value && typeof value === 'object') return firstImage((value as { url?: unknown }).url);
  return null;
}

/** Recipe nodes of a JSON-LD document, flat or inside `@graph`. */
function recipeNodes(doc: unknown): Record<string, unknown>[] {
  const nodes = Array.isArray(doc) ? doc : [doc];
  return nodes.flatMap((n) => {
    if (!n || typeof n !== 'object') return [];
    const node = n as Record<string, unknown>;
    const type = node['@type'];
    const isRecipe = type === 'Recipe' || (Array.isArray(type) && type.includes('Recipe'));
    return [...(isRecipe ? [node] : []), ...recipeNodes(node['@graph'])];
  });
}

/**
 * The cover photo of an imported page, or null. Looks at the JSON-LD Recipe `image` first, then
 * `og:image`. The URL is resolved against the page URL and kept only if it is an https URL on
 * an allowed host (`IMAGE_HOSTS`), so a page can't point the app at an arbitrary server.
 */
export function extractImageUrl(html: string, pageUrl: string): string | null {
  const $ = cheerio.load(html);
  const candidates: (string | null)[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      for (const node of recipeNodes(JSON.parse($(el).text()))) candidates.push(firstImage(node.image));
    } catch {
      // Malformed JSON-LD is common; fall through to og:image.
    }
  });
  candidates.push($('meta[property="og:image"]').attr('content') ?? null);

  for (const raw of candidates) {
    if (!raw) continue;
    try {
      const resolved = new URL(raw.trim(), pageUrl).toString();
      if (isAllowedImageUrl(resolved)) return resolved;
    } catch {
      // Unresolvable URL: try the next candidate.
    }
  }
  return null;
}
