import { NextResponse } from 'next/server';
import { fetchPage } from '@/lib/import/fetch';
import { cleanHtml } from '@/lib/import/clean';
import { extractImageUrl } from '@/lib/import/image';

export async function POST(req: Request) {
  const { url } = await req.json();
  if (!url || typeof url !== 'string') return NextResponse.json({ error: 'url required' }, { status: 400 });
  try {
    const html = await fetchPage(url);
    const markdown = cleanHtml(html);
    return NextResponse.json({ markdown, image_url: extractImageUrl(html, url) });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
