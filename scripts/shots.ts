/**
 * Screenshots of the signed-in screens at 390 and 1280 px, light and dark, so a UI change can be checked by eye
 * (design brief; the redesign epic asks for all four per screen). Needs `pnpm dev` and a saved session.
 *
 * Usage: pnpm shots --login        sign in once in a browser window; saves the session to .shots/state.json
 *        pnpm shots [/route ...]   writes .shots/<route>-<width>-<scheme>.png (default: plan, recipes, shopping, settings)
 * Env:   SHOTS_URL (default http://localhost:3000), SHOTS_STATE (default .shots/state.json)
 */
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

const ROUTES = ['/plan', '/recipes', '/shopping', '/settings'];
const WIDTHS = [390, 1280];
const SCHEMES = ['light', 'dark'] as const;

/** `/recipes/abc` at 390 px in dark mode → `recipes-abc-390-dark.png`. */
export function shotName(route: string, width: number, scheme: string): string {
  const slug = route.replace(/^\/+|\/+$/g, '').replace(/[^a-zA-Z0-9]+/g, '-') || 'home';
  return `${slug}-${width}-${scheme}.png`;
}

async function login(base: string, state: string) {
  const browser = await chromium.launch({ channel: 'chrome', headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${base}/login`);
  console.log('shots: sign in in the browser window (5 minutes)…');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 300_000 });
  await context.storageState({ path: state });
  await browser.close();
  console.log(`shots: session saved to ${state}`);
}

async function shoot(base: string, state: string, routes: string[]) {
  mkdirSync('.shots', { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome' });
  for (const colorScheme of SCHEMES) {
    for (const width of WIDTHS) {
      const context = await browser.newContext({
        storageState: state,
        colorScheme,
        viewport: { width, height: width < 600 ? 844 : 800 },
      });
      const page = await context.newPage();
      for (const route of routes) {
        await page.goto(`${base}${route}`, { waitUntil: 'networkidle' });
        if (new URL(page.url()).pathname.startsWith('/login')) {
          throw new Error(`shots: ${route} redirected to /login. Run "pnpm shots --login" again.`);
        }
        const file = `.shots/${shotName(route, width, colorScheme)}`;
        await page.screenshot({ path: file, fullPage: true });
        console.log(`shots: ${file}`);
      }
      await context.close();
    }
  }
  await browser.close();
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const base = process.env.SHOTS_URL ?? 'http://localhost:3000';
  const state = resolve(process.env.SHOTS_STATE ?? '.shots/state.json');
  const args = process.argv.slice(2);
  if (args.includes('--login')) {
    mkdirSync('.shots', { recursive: true });
    await login(base, state);
  } else {
    await shoot(base, state, args.length ? args : ROUTES);
  }
}
