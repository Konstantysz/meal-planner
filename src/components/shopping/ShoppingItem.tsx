'use client';
import type { ShoppingItem as Item } from '@/lib/types';

export function ShoppingItem({ item, have, onToggle }: { item: Item; have: boolean; onToggle: () => void }) {
  const amount =
    item.total_amount !== null
      ? `${Math.round(item.total_amount * 100) / 100}${item.unit ? ' ' + item.unit : ''}`
      : item.raw_amounts.join(' + ');
  return (
    <li className="border-b border-line last:border-0">
      <label className="flex min-h-11 cursor-pointer items-center gap-3 py-2 lg:min-h-9">
        <input
          type="checkbox"
          checked={have}
          onChange={onToggle}
          className="size-5 shrink-0 accent-brand scheme-light-dark"
        />
        <span className="min-w-0 flex-1">
          <span className={have ? 'font-medium text-muted line-through' : 'font-medium'}>{item.ingredient_name}</span>
          {item.incomplete && (
            <span className="ml-2 text-xs text-muted" title="Co najmniej jeden składnik nie ma danych o makro">
              (brak makro)
            </span>
          )}
          <span className="sr-only">{have ? ' — mam to' : ''}</span>
        </span>
        <span className={`text-sm tabular-nums ${have ? 'text-muted line-through' : 'text-muted'}`}>{amount}</span>
      </label>
    </li>
  );
}
