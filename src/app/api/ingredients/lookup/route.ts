import { NextResponse } from 'next/server';
import { searchOff } from '@/lib/off';

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get('q');
  if (!q) return NextResponse.json({ error: 'q required' }, { status: 400 });

  try {
    return NextResponse.json(await searchOff(q));
  } catch (e) {
    console.error('Failed to lookup ingredients:', e);
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 });
  }
}
