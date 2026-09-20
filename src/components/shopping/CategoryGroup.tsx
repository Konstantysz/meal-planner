'use client';
import type { ShoppingItem as Item } from '@/lib/types';
import { ShoppingItem } from './ShoppingItem';

const LABELS: Record<string, string> = {
  warzywa: 'Warzywa', owoce: 'Owoce', mieso: 'Mięso', ryby: 'Ryby',
  nabial: 'Nabiał', pieczywo: 'Pieczywo', makarony: 'Makarony',
  przyprawy: 'Przyprawy', tluszcze: 'Tłuszcze', napoje: 'Napoje', inne: 'Inne',
};

export function CategoryGroup({
  category, items, have, onToggle,
}: {
  category: string; items: Item[]; have: Record<string, boolean>;
  onToggle: (item: Item) => void;
}) {
  return (
    <section className="mb-4">
      <h3 className="font-semibold text-sm uppercase text-gray-500 mb-1">{LABELS[category] ?? category}</h3>
      <div className="border rounded">
        {items.map((it) => (
          <ShoppingItem
            key={`${it.ingredient_id}-${it.unit ?? 'none'}`}
            item={it}
            have={!!have[`${it.ingredient_id}::${it.unit ?? 'none'}`]}
            onToggle={() => onToggle(it)}
          />
        ))}
      </div>
    </section>
  );
}
