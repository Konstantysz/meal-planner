import { connection } from 'next/server';
import { ShoppingList } from '@/components/shopping/ShoppingList';
import { weekStartOf } from '@/lib/week';

export default async function ShoppingPage() {
  await connection();
  const week = weekStartOf(new Date());
  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-6 lg:px-8 lg:py-8">
      <header className="space-y-1">
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Zakupy</h1>
        <p className="text-sm text-muted">{'„Mam to" zapisuje się tylko na tym urządzeniu.'}</p>
      </header>
      <ShoppingList week={week} />
    </div>
  );
}
