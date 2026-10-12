import { connection } from 'next/server';
import { WeekPlan } from '@/components/plan/WeekPlan';
import { weekStartOf } from '@/lib/week';

export default async function PlanPage() {
  // Opt out of static pre-render: "this week" must be computed per request.
  await connection();
  return <WeekPlan weekStart={weekStartOf(new Date())} />;
}
