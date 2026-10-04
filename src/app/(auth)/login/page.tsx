import { AuthForm } from '@/components/auth/AuthForm';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <AuthForm
      mode="login"
      initialError={error === 'link' ? 'Link wygasł lub jest nieprawidłowy. Poproś o nowy.' : undefined}
    />
  );
}
