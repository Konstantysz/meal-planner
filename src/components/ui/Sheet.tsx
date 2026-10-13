'use client';
import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';

/** Bottom sheet below the desktop breakpoint, centred dialog from it up. Native <dialog> traps focus and closes on Escape. */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={() => {
        if (open) onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className="anim-sheet m-0 mt-auto max-h-[85vh] w-full max-w-none rounded-t-sheet bg-background p-0 text-ink backdrop:bg-scrim lg:m-auto lg:max-w-md lg:rounded-sheet"
    >
      <div className="p-4">
        <h2 id={titleId} className="mb-3 font-display text-lg font-semibold">
          {title}
        </h2>
        {open && children}
      </div>
    </dialog>
  );
}
