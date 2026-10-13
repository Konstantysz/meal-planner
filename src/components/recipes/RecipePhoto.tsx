'use client';
import { useState } from 'react';
import Image from 'next/image';
import { isAllowedImageUrl } from '@/lib/image-hosts';

/**
 * The photo layer of a recipe cover (design brief, "Recipe cover and photos"): fills its nearest
 * positioned parent and sits over the parent's colour. Renders nothing without a usable photo or
 * when the hotlink fails to load, so the parent's colour shows through as the fallback.
 * `scrim` adds the bottom gradient that keeps a title legible on a photo.
 */
export function RecipePhoto({
  src,
  sizes,
  scrim = false,
}: {
  src: string | null | undefined;
  sizes: string;
  scrim?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed || !isAllowedImageUrl(src)) return null;
  return (
    <>
      <Image
        src={src}
        alt=""
        fill
        sizes={sizes}
        className="object-cover"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
      {scrim && <div aria-hidden className="absolute inset-0 bg-linear-to-t from-scrim to-transparent" />}
    </>
  );
}

/** 16:9 band for the detail page: renders nothing (no empty grey band) when there is no usable photo or it fails to load. */
export function RecipePhotoBand({ src, sizes }: { src: string | null | undefined; sizes: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed || !isAllowedImageUrl(src)) return null;
  return (
    <div className="relative aspect-video overflow-hidden rounded-block bg-hover">
      <Image
        src={src}
        alt=""
        fill
        sizes={sizes}
        className="object-cover"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
    </div>
  );
}
