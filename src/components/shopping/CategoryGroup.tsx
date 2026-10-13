'use client';
import type { ShoppingItem as Item } from '@/lib/types';
import { ShoppingItem } from './ShoppingItem';

const LABELS: Record<string, string> = {
  warzywa: 'Warzywa',
  owoce: 'Owoce',
  mieso: 'Mięso',
  ryby: 'Ryby',
  nabial: 'Nabiał',
  pieczywo: 'Pieczywo',
  makarony: 'Makarony',
  przyprawy: 'Przyprawy',
  tluszcze: 'Tłuszcze',
  napoje: 'Napoje',
  inne: 'Inne',
};

export function CategoryGroup({
  category,
  items,
  have,
  onToggle,
}: {
  category: string;
  items: Item[];
  have: Record<string, boolean>;
  onToggle: (item: Item) => void;
}) {
  const key = (it: Item) => `${it.ingredient_id}::${it.unit ?? 'none'}`;
  const done = items.filter((it) => have[key(it)]).length;
  return (
    <section>
      <h2 className="flex items-baseline justify-between border-b border-line pb-1 font-display text-lg font-semibold">
        {LABELS[category] ?? category}
        <span className="text-sm font-normal tabular-nums text-muted">
          {done}/{items.length}
        </span>
      </h2>
      <ul>
        {items.map((it) => (
          <ShoppingItem
            key={`${it.ingredient_id}-${it.unit ?? 'none'}`}
            item={it}
            have={!!have[key(it)]}
            onToggle={() => onToggle(it)}
          />
        ))}
      </ul>
    </section>
  );
}
