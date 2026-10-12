import { connection } from 'next/server';
import { ShoppingList } from '@/components/shopping/ShoppingList';
import { weekStartOf } from '@/lib/week';

export default async function ShoppingPage() {
  await connection();
  const week = weekStartOf(new Date());
  return (
    <div>
      <h1 className="text-2xl font-bold p-4">Zakupy</h1>
      <ShoppingList week={week} />
    </div>
  );
}
