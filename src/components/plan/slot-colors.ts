// Full class names so Tailwind sees them. Positions above 4 and empty slots use the neutral colour.
const FILLED = ['bg-slot-0', 'bg-slot-1', 'bg-slot-2', 'bg-slot-3', 'bg-slot-4'];

export function slotClass(position: number, filled: boolean): string {
  if (!filled) return 'border border-line text-ink';
  return `${FILLED[position] ?? 'bg-hover'} text-on-slot`;
}
