/**
 * Validates docs/wiki against docs/wiki/RULES.md: frontmatter schema, required sections,
 * wikilink/anchor/alias resolution, unique basenames, orphans and parent-index links.
 * Markdown style is markdownlint-cli2's job (`pnpm wiki:check` runs both).
 *
 * Usage: pnpm tsx scripts/wiki-check.ts
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';

export interface WikiFile {
  /** Posix path relative to the wiki root, e.g. `concepts/week-plan.md`. */
  path: string;
  content: string;
}

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD');

const SourceSchema = z.strictObject({
  title: z.string().min(1),
  path: z.string().min(1).optional(),
  url: z.string().url().optional(),
  accessed: date.optional(),
}).refine((s) => !!s.path !== !!s.url, 'source needs exactly one of path or url')
  .refine((s) => !s.url || !!s.accessed, 'web source needs accessed');

const FrontmatterSchema = z.strictObject({
  title: z.string().min(1),
  summary: z.string().min(1),
  tags: z.array(z.string()).min(1),
  aliases: z.array(z.string()).optional(),
  status: z.enum(['draft', 'review', 'stable', 'deprecated']),
  owner: z.string(),
  created: date,
  updated: date,
  last_reviewed: date.nullable(),
  review_interval_days: z.number().int().positive(),
  confidence: z.enum(['low', 'medium', 'high']),
  llm_generated: z.boolean(),
  llm_model: z.string(),
  human_reviewed: z.boolean(),
  verified_commit: z.string().regex(/^[0-9a-f]{7,40}$/).optional(),
  sources: z.array(SourceSchema),
  allowed_tags: z.array(z.string()).optional(),
});
type Frontmatter = z.infer<typeof FrontmatterSchema>;

const REQUIRED_H2 = ['Context', 'Related', 'Sources', 'Changelog'];
// Top-level folder → its index page basename (RULES §2).
const FOLDER_INDEX: Record<string, string> = {
  concepts: 'concepts', guides: 'guides', references: 'references', decisions: 'decisions', _meta: 'meta',
};

interface Page {
  file: WikiFile;
  name: string;
  fm: Frontmatter | null;
  headings: string[];
  links: { target: string; anchor: string | null }[];
}

const basename = (p: string) => p.split('/').at(-1)!.replace(/\.md$/, '');

function splitFrontmatter(content: string): { yaml: string | null; body: string } {
  const text = content.replace(/\r\n/g, '\n');
  const m = text.match(/^---\n([\s\S]*?)\n---\n/);
  return m ? { yaml: m[1], body: text.slice(m[0].length) } : { yaml: null, body: text };
}

// Links and headings inside code are examples, not structure.
function stripCode(body: string): string {
  return body.replace(/^(```|~~~)[\s\S]*?^\1/gm, '').replace(/`[^`\n]*`/g, '');
}

function parsePage(file: WikiFile, errors: string[]): Page {
  const { yaml, body } = splitFrontmatter(file.content);
  let fm: Frontmatter | null = null;
  if (yaml === null) {
    errors.push(`${file.path}: missing frontmatter`);
  } else {
    const parsed = FrontmatterSchema.safeParse(parseYaml(yaml));
    if (parsed.success) fm = parsed.data;
    else for (const issue of parsed.error.issues) {
      errors.push(`${file.path}: frontmatter ${issue.path.join('.') || '(root)'}: ${issue.message}`);
    }
  }
  const prose = stripCode(body);
  const headings = [...prose.matchAll(/^#{1,6}\s+(.+?)\s*$/gm)].map((m) => m[1]);
  const links = [...prose.matchAll(/!?\[\[([^\]]+)\]\]/g)].map((m) => {
    const [ref] = m[1].split('|');
    const [target, anchor] = ref.split('#');
    return { target: target.trim(), anchor: anchor?.trim() || null };
  });
  if (/\]\((?!https?:)[^)\s]*\.md(#[^)]*)?\)/.test(prose)) {
    errors.push(`${file.path}: use [[wikilinks]], not relative markdown links`);
  }
  return { file, name: basename(file.path), fm, headings, links };
}

function checkStructure(page: Page, errors: string[]) {
  const { file, fm, headings } = page;
  const body = stripCode(splitFrontmatter(file.content).body);
  const h1 = body.match(/^#\s+(.+?)\s*$/m)?.[1];
  if (!h1) errors.push(`${file.path}: missing # title`);
  else if (fm && h1 !== fm.title) errors.push(`${file.path}: # title "${h1}" != frontmatter title "${fm.title}"`);
  if (!/^>\s*\[!tldr\]/im.test(body)) errors.push(`${file.path}: missing > [!tldr] callout`);
  for (const h of REQUIRED_H2) {
    if (!new RegExp(`^##\\s+${h}\\s*$`, 'm').test(body)) errors.push(`${file.path}: missing ## ${h}`);
  }
  if (!headings.length) errors.push(`${file.path}: no headings`);
}

function checkFrontmatter(page: Page, allowedTags: Set<string> | null, repoFileExists: (p: string) => boolean, errors: string[]) {
  const { fm, file } = page;
  if (!fm) return;
  if (fm.status === 'stable') {
    if (!fm.owner) errors.push(`${file.path}: stable page needs owner`);
    if (!fm.last_reviewed) errors.push(`${file.path}: stable page needs last_reviewed`);
    if (!fm.human_reviewed) errors.push(`${file.path}: stable page needs human_reviewed: true`);
  }
  if (fm.llm_generated && !fm.llm_model) errors.push(`${file.path}: llm_generated page needs llm_model`);
  if (allowedTags) {
    for (const t of fm.tags) if (!allowedTags.has(t)) errors.push(`${file.path}: tag "${t}" not in taxonomy`);
  }
  for (const s of fm.sources) {
    if (s.path && !repoFileExists(s.path)) errors.push(`${file.path}: source path not found: ${s.path}`);
  }
}

export function checkWiki(files: WikiFile[], repoFileExists: (p: string) => boolean): string[] {
  const errors: string[] = [];
  const pages = files.map((f) => parsePage(f, errors));

  const byName = new Map<string, Page>();
  for (const p of pages) {
    const key = p.name.toLowerCase();
    if (byName.has(key)) errors.push(`${p.file.path}: basename "${p.name}" also used by ${byName.get(key)!.file.path}`);
    byName.set(key, p);
  }
  for (const p of pages) {
    for (const alias of p.fm?.aliases ?? []) {
      const key = alias.toLowerCase();
      if (byName.has(key) && byName.get(key) !== p) errors.push(`${p.file.path}: alias "${alias}" collides with another page`);
      else byName.set(key, p);
    }
  }

  const taxonomy = byName.get('taxonomy')?.fm?.allowed_tags;
  const allowedTags = taxonomy ? new Set(taxonomy) : null;
  const inbound = new Map<Page, number>();

  for (const page of pages) {
    checkStructure(page, errors);
    checkFrontmatter(page, allowedTags, repoFileExists, errors);
    if (!page.links.length) errors.push(`${page.file.path}: no outbound wikilinks`);
    for (const { target, anchor } of page.links) {
      const label = `[[${target}${anchor ? '#' + anchor : ''}]]`;
      if (target.includes('/')) { errors.push(`${page.file.path}: ${label} must link by basename`); continue; }
      const dest = byName.get(target.toLowerCase());
      if (!dest) { errors.push(`${page.file.path}: broken link ${label}`); continue; }
      if (anchor && !dest.headings.some((h) => h.toLowerCase() === anchor.toLowerCase())) {
        errors.push(`${page.file.path}: ${label} anchor not found`);
      }
      if (dest !== page) inbound.set(dest, (inbound.get(dest) ?? 0) + 1);
    }
    const folder = page.file.path.includes('/') ? page.file.path.split('/')[0] : null;
    const parent = folder ? FOLDER_INDEX[folder] : 'README';
    if (parent && page.name !== parent && !page.links.some((l) => l.target.toLowerCase() === parent.toLowerCase())) {
      errors.push(`${page.file.path}: must link its index [[${parent}]]`);
    }
  }
  for (const page of pages) {
    if (page.name !== 'README' && !inbound.get(page)) errors.push(`${page.file.path}: orphan (no inbound links)`);
  }
  return errors;
}

const SKIP_DIRS = new Set(['.obsidian', '_templates', '.trash']);

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (e.isDirectory()) return SKIP_DIRS.has(e.name) ? [] : walk(join(dir, e.name));
    return e.name.endsWith('.md') ? [join(dir, e.name)] : [];
  });
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const root = join(process.cwd(), 'docs', 'wiki');
  const files = walk(root).map((abs) => ({
    path: relative(root, abs).split(sep).join('/'),
    content: readFileSync(abs, 'utf8'),
  }));
  const errors = checkWiki(files, (p) => existsSync(join(process.cwd(), p)));
  for (const e of errors) console.error(e);
  console.log(`wiki-check: ${files.length} pages, ${errors.length} error(s)`);
  process.exit(errors.length ? 1 : 0);
}
