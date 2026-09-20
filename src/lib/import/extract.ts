import { parseLlmJson } from './schema';
import type { RecipeJsonLd } from '@/lib/schemas';

export type LlmFn = (system: string, user: string) => Promise<string>;

export async function extractRecipe(
  markdown: string,
  llm: LlmFn,
  systemPrompt: string,
  maxRetries = 2
): Promise<RecipeJsonLd> {
  let lastError = '';
  for (let i = 0; i <= maxRetries; i++) {
    const user = i === 0
      ? markdown
      : `${markdown}\n\nUWAGA: poprzednia odpowiedź nie pasowała do schematu (${lastError}). Spróbuj ponownie, zwróć TYLKO poprawny JSON.`;
    const raw = await llm(systemPrompt, user);
    try { return parseLlmJson(raw); }
    catch (e) { lastError = String(e); }
  }
  throw new Error(`LLM failed to produce valid recipe: ${lastError}`);
}
