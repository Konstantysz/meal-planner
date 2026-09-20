import { notFound } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase/server';
import { getWeekPlan } from '@/lib/db/plans';

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createServerSupabase();
  const { data: st } = await supabase.from('share_tokens').select('plan_id').eq('token', token).maybeSingle();
  if (!st) notFound();
  const plan = await getWeekPlan(supabase, st.plan_id);

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold mb-4">Plan tygodnia od {plan.week_start_date}</h1>
      <ul className="space-y-2">
        {plan.slots
          .slice()
          .sort((a, b) => a.date.localeCompare(b.date) || a.position - b.position)
          .map((s) => (
            <li key={s.id} className="border rounded p-2">
              <span className="text-xs text-gray-500">{s.date} · {s.label ?? `posiłek ${s.position + 1}`}</span>
              <div>{s.recipe?.name ?? '—'}</div>
            </li>
          ))}
      </ul>
    </div>
  );
}
