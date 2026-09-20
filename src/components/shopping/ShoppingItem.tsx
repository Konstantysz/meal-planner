'use client';
import type { ShoppingItem as Item } from '@/lib/types';

export function ShoppingItem({
  item, have, onToggle,
}: { item: Item; have: boolean; onToggle: () => void }) {
  const amount = item.total_amount !== null
    ? `${Math.round(item.total_amount * 100) / 100}${item.unit ? ' ' + item.unit : ''}`
    : item.raw_amounts.join(' + ');
  return (
    <label className="flex items-center gap-3 py-2 border-b last:border-0">
      <input type="checkbox" checked={have} onChange={onToggle} className="w-5 h-5" />
      <span className={have ? 'line-through text-gray-400' : ''}>
        <strong>{item.ingredient_name}</strong>
        {item.incomplete && <span className="ml-1 text-xs text-amber-600">(brak makro)</span>}
      </span>
      <span className="ml-auto text-sm text-gray-600">{amount}</span>
    </label>
  );
}
