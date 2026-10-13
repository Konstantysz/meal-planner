import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PlanSlot } from '@/components/plan/PlanSlot';

describe('PlanSlot servings stepper', () => {
  it('reports servings +/- 1 and stops at 1', () => {
    const onServingsChange = vi.fn();
    const { rerender } = render(
      <PlanSlot label="obiad" position={2} recipeName="Zupa" servings={2} onServingsChange={onServingsChange} />,
    );
    fireEvent.click(screen.getByLabelText('Więcej porcji'));
    fireEvent.click(screen.getByLabelText('Mniej porcji'));
    expect(onServingsChange.mock.calls).toEqual([[3], [1]]);

    rerender(
      <PlanSlot label="obiad" position={2} recipeName="Zupa" servings={1} onServingsChange={onServingsChange} />,
    );
    expect((screen.getByLabelText('Mniej porcji') as HTMLButtonElement).disabled).toBe(true);
  });

  it('offers move only for a filled slot', () => {
    const onMove = vi.fn();
    const { rerender } = render(<PlanSlot label="obiad" position={2} recipeName={null} onMove={onMove} />);
    expect(screen.queryByLabelText('Przenieś posiłek')).toBeNull();
    rerender(<PlanSlot label="obiad" position={2} recipeName="Zupa" servings={1} onMove={onMove} />);
    fireEvent.click(screen.getByLabelText('Przenieś posiłek'));
    expect(onMove).toHaveBeenCalledOnce();
  });
});
