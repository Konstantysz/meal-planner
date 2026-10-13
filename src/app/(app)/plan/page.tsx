import { connection } from 'next/server';
import { WeekPlan } from '@/components/plan/WeekPlan';
import { resolveWeek } from '@/lib/week';

export default async function PlanPage({ searchParams }: { searchParams: Promise<{ week?: string | string[] }> }) {
  // Opt out of static pre-render: "this week" must be computed per request.
  await connection();
  const weekStart = resolveWeek((await searchParams).week, new Date());
  // key: a week change remounts the plan, so the previous week is never shown under the new heading.
  return <WeekPlan key={weekStart} weekStart={weekStart} />;
}
