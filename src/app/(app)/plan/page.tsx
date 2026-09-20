import { startOfWeek, format } from 'date-fns';
import { WeekPlan } from '@/components/plan/WeekPlan';

export default function PlanPage() {
  const week = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
  return <WeekPlan weekStart={week} />;
}
