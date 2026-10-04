import { NextResponse } from 'next/server';
import { extractRecipe } from '@/lib/import/extract';
import { callOllama } from '@/lib/import/ollama';
import { SYSTEM_PROMPT } from '@/lib/import/schema';

// LLM_MODE=server → the browser skips WebLLM and always calls POST below.
export function GET() {
  return NextResponse.json({ mode: process.env.LLM_MODE === 'server' ? 'server' : 'browser' });
}

export async function POST(req: Request) {
  const { markdown } = await req.json();
  if (!markdown || typeof markdown !== 'string') {
    return NextResponse.json({ error: 'markdown required' }, { status: 400 });
  }
  try {
    const recipe = await extractRecipe(markdown, callOllama, SYSTEM_PROMPT, 2);
    return NextResponse.json(recipe);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
