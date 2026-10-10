import * as cheerio from 'cheerio';
import TurndownService from 'turndown';
import { MAX_MARKDOWN_CHARS } from './schema';

const turndown = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-' });
// URLs are pure token cost for the model — keep link text only.
turndown.addRule('linkText', { filter: 'a', replacement: (content) => content });

const CONTENT_SELECTORS = [
  'article[itemtype*="Recipe"]',
  '.article-content',
  '.entry-content',
  '.recipe-content',
  'main article',
  'article',
  'main',
];

const NOISE = [
  'script, style, nav, footer, header, aside, iframe, noscript, svg',
  // Group headers ("Składniki do podania") are buttons; keep them so a second list stays labelled.
  'img, picture, figure, video, form, button:not(.ing-header)',
  '[class*="ad-"], [class*="advert"], [id*="cookie"]',
  '[id*="comment"], [class*="comment"], [class*="share"], [class*="social"]',
  // Related-recipe cards nested inside the main recipe: their ingredients leak into extraction.
  '[itemtype*="Recipe"] [itemtype*="Recipe"]',
].join(', ');

const INGREDIENT = '[itemprop="recipeIngredient"]';

// aniagotuje renders name and quantity as separate spans; flattened they read "tymianek garść
// łodyg" and the model drops the trailing quantity. Quantity-first matches the output format.
function ingredientText($: cheerio.CheerioAPI, el: Parameters<typeof $>[0]): string {
  const qty = $(el).find('.ingredient-qty').text().trim();
  const name = $(el).find('.ingredient-name').text().trim();
  return qty && name ? `${qty} ${name}` : $(el).text().replace(/\s+/g, ' ').trim();
}

// Ingredient lines straight from the page's markup, in order. A small LLM retypes this list badly
// (loops, drops " - około 15 g" comments), so when the markup has it the model isn't asked for it.
export function extractIngredients(html: string): string[] {
  const $ = cheerio.load(html);
  $(NOISE).remove();
  return $(INGREDIENT)
    .map((_, el) => ingredientText($, el))
    .get()
    .filter(Boolean);
}

export function cleanHtml(html: string): string {
  const $ = cheerio.load(html);
  $(NOISE).remove();
  $(INGREDIENT).each((_, el) => {
    $(el).text(ingredientText($, el));
  });

  let content = '';
  for (const sel of CONTENT_SELECTORS) {
    const el = $(sel).first();
    if (el.length && el.text().trim().length > 200) {
      content = el.html() ?? '';
      break;
    }
  }
  if (!content) content = $('body').html() ?? '';
  const md = turndown
    .turndown(content)
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return cropToRecipe(polishQuotes(md));
}

// An ASCII `"` copied from the source into a JSON string value makes small models lose track of
// escaping (gemma2 then loops on whitespace until max tokens). „” never need escaping.
function polishQuotes(md: string): string {
  return md.replace(/"([^"\n]*)"/g, '„$1”').replaceAll('"', '”');
}

const INGREDIENTS_HEADER = /^[^\p{L}\n]*(składniki|ingredients)\b/gimu;

// Blog posts bury the recipe in prose. Over budget → keep the title plus a window starting at
// the "Składniki" header with the most quantities (digits) after it — a page can have several
// (tag lists, related posts), the real ingredient list is the number-dense one.
// ponytail: digit-density heuristic, per-site selectors if a source keeps losing the recipe.
export function cropToRecipe(md: string): string {
  if (md.length <= MAX_MARKDOWN_CHARS) return md;
  const title = md.match(/^# .+$/m)?.[0] ?? '';
  let best = -1;
  let bestScore = -1;
  for (const m of md.matchAll(INGREDIENTS_HEADER)) {
    const score = (md.slice(m.index, m.index + 600).match(/\d/g) ?? []).length;
    if (score > bestScore) {
      best = m.index;
      bestScore = score;
    }
  }
  const body = best >= 0 ? md.slice(best) : md;
  const head = title && !body.startsWith(title) ? `${title}\n\n` : '';
  return (head + body).slice(0, MAX_MARKDOWN_CHARS);
}
