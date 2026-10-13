import { redirect } from 'next/navigation';

export default async function Home({ searchParams }: { searchParams: Promise<{ week?: string | string[] }> }) {
  const week = (await searchParams).week;
  const value = Array.isArray(week) ? week[0] : week;
  redirect(value ? `/plan?week=${encodeURIComponent(value)}` : '/plan');
}
