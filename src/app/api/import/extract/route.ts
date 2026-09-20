import { NextResponse } from 'next/server';
import { extractRecipe } from '@/lib/import/extract';
import { callGemini, SYSTEM_PROMPT } from '@/lib/import/gemini';

export async function POST(req: Request) {
  const { markdown } = await req.json();
  if (!markdown || typeof markdown !== 'string') {
    return NextResponse.json({ error: 'markdown required' }, { status: 400 });
  }
  try {
    const recipe = await extractRecipe(markdown, callGemini, SYSTEM_PROMPT, 2);
    return NextResponse.json(recipe);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
