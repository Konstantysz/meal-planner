import { notFound } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase/server';
import { getSharedPlan } from '@/lib/db/share';

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createServerSupabase();
  const plan = await getSharedPlan(supabase, token);
  if (!plan) notFound();

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold mb-4">Plan tygodnia od {plan.week_start_date}</h1>
      <ul className="space-y-2">
        {plan.slots.map((s) => (
          <li key={s.id} className="border rounded p-2">
            <span className="text-xs text-gray-500">
              {s.date} · {s.label ?? `posiłek ${s.position + 1}`}
            </span>
            <div>{s.recipe?.name ?? '—'}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
