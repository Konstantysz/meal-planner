# Import

Pipeline: `fetchPage(url)` (`src/lib/import/fetch.ts`) downloads raw HTML with a custom User-Agent → `cleanHtml(html)` (`src/lib/import/clean.ts`) strips noise and converts the main content to Markdown via cheerio + turndown. Later tasks feed that Markdown to an LLM for structured recipe extraction.

`cleanHtml` removes `script, style, nav, footer, header, aside, iframe, noscript, svg` and anything matching `[class*="ad-"]`, `[class*="advert"]`, `[id*="cookie"]`, then tries selectors in order and takes the first match with >200 chars of text: `article[itemtype*="Recipe"]` → `.article-content` → `.entry-content` → `.recipe-content` → `main article` → `article` → `main`, falling back to `body`.

Fixtures (`tests/fixtures/jadlonomia/sample.html`, `tests/fixtures/aniagotuje/sample.html`) are **real HTML**, fetched with curl from live recipe pages (jadlonomia.com/przepisy/dyniowa-pomidorowa, aniagotuje.pl/przepis/zupa-pomidorowa). Both use `<article itemtype=".../Recipe">` (schema.org Recipe microdata), so they hit the first selector in `CONTENT_SELECTORS`.
