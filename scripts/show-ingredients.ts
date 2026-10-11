/**
 * Prints only the ingredient section of recipe pages, as the import pipeline sees them (fetchPage -> cleanHtml).
 * For reading real ingredient lines without dumping whole recipes into the terminal.
 *
 * Usage: pnpm show:ingredients <url> [<url> ...]
 */
import { pathToFileURL } from 'node:url';

const MAX_LINES = 60;

// ponytail: line heuristics over the cleaned Markdown, not per-site parsers. Add a case when a site breaks it.
export function ingredientSection(md: string): string {
  const lines = md.split('\n').filter((l) => l.trim() !== '');
  const bare = (l: string) => l.replace(/^[#*\s]+/, '');
  // A header line starts with "Składniki"; jadłonomia opens with a tag list ("Składniki:" then "Danie:") to skip.
  const start = lines.findIndex((l, i) => /^składniki\b/i.test(bare(l)) && !/^danie:/i.test(bare(lines[i + 2] ?? '')));
  if (start === -1) return '';
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => /^#{1,6}\s|^krok\s|^przygotowanie\b/i.test(l.replace(/^\*+/, '').trim()));
  return [lines[start], ...(end === -1 ? rest : rest.slice(0, end))]
    .map((l) => l.trim())
    .slice(0, MAX_LINES)
    .join('\n');
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const urls = process.argv.slice(2);
  if (urls.length === 0) {
    console.error('Usage: pnpm show:ingredients <url> [<url> ...]');
    process.exit(1);
  }
  (async () => {
    const { fetchPage } = await import('../src/lib/import/fetch');
    const { cleanHtml } = await import('../src/lib/import/clean');
    for (const url of urls) {
      console.log(
        `\n=== ${url}\n${ingredientSection(cleanHtml(await fetchPage(url))) || '(no ingredient section found)'}`,
      );
    }
  })().catch((e) => {
    console.error(String(e));
    process.exit(1);
  });
}
