import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

// Target of the password-recovery email link: swaps the one-time `code` for a session cookie,
// then sends the user to the new-password form. The destination is fixed (no `next` param) so
// the route can't be used as an open redirect.
export async function GET(req: Request) {
  const { origin, searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  if (code) {
    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}/reset-password`);
  }
  return NextResponse.redirect(`${origin}/login?error=link`);
}
