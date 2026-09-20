import { startOfWeek, format } from 'date-fns';
import { ShoppingList } from '@/components/shopping/ShoppingList';

export default function ShoppingPage() {
  const week = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
  return <div><h1 className="text-2xl font-bold p-4">Zakupy</h1><ShoppingList week={week} /></div>;
}
