import * as cheerio from 'cheerio';
import TurndownService from 'turndown';

const turndown = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-' });

const CONTENT_SELECTORS = [
  'article[itemtype*="Recipe"]',
  '.article-content',
  '.entry-content',
  '.recipe-content',
  'main article',
  'article',
  'main',
];

export function cleanHtml(html: string): string {
  const $ = cheerio.load(html);
  $('script, style, nav, footer, header, aside, iframe, noscript, svg').remove();
  $('[class*="ad-"], [class*="advert"], [id*="cookie"]').remove();

  let content = '';
  for (const sel of CONTENT_SELECTORS) {
    const el = $(sel).first();
    if (el.length && el.text().trim().length > 200) {
      content = el.html() ?? '';
      break;
    }
  }
  if (!content) content = $('body').html() ?? '';
  return turndown.turndown(content).trim();
}
