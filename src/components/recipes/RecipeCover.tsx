import type { ReactNode } from 'react';
import { Icon } from '@/components/ui';
import { cx } from '@/components/ui/cx';

/**
 * Recipe cover: 3:4 on cards, a wide band on the detail page. Without a photo it is the name on a flat tint;
 * `photo` is the slot for an image element (it fills the cover and the name moves onto a bottom scrim), so
 * adding photos changes no layout (design brief, "Recipe cover and photos").
 * The tint is `hover` until covers take the colour of the slot position a recipe is most often planned in.
 */
export function RecipeCover({
  name,
  prepTimeMin,
  photo,
  variant = 'card',
}: {
  name?: string;
  prepTimeMin: number | null;
  photo?: ReactNode;
  variant?: 'card' | 'band';
}) {
  return (
    <div
      className={cx(
        'relative flex flex-col justify-between overflow-hidden rounded-block bg-hover p-3 text-on-slot',
        variant === 'card' ? 'aspect-[3/4]' : 'h-24 lg:h-36',
      )}
    >
      {photo && <div className="absolute inset-0 [&>*]:h-full [&>*]:w-full [&>*]:object-cover">{photo}</div>}
      <span className="relative inline-flex items-center gap-1 text-xs tabular-nums">
        {prepTimeMin != null && (
          <>
            <Icon name="time" width={14} height={14} />
            {prepTimeMin} min
          </>
        )}
      </span>
      {name && (
        <h3
          className={cx(
            'relative font-display text-xl font-extrabold leading-tight [hyphens:auto] [text-wrap:balance]',
            !!photo && '-m-3 bg-gradient-to-t from-scrim to-transparent p-3 pt-8',
          )}
        >
          {name}
        </h3>
      )}
    </div>
  );
}
