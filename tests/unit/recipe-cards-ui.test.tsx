import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RecipeSteps } from '@/components/recipes/RecipeSteps';
import { RecipeIngredients } from '@/components/recipes/RecipeIngredients';
import { RecipeCard } from '@/components/recipes/RecipeCard';
import type { RecipeListItem } from '@/lib/db/recipes';

const steps = [
  { id: 's1', title: 'Sos', text: 'Podsmaż cebulę.' },
  { id: 's2', title: null, text: 'Wymieszaj całość.' },
  { id: 's3', title: 'Podanie', text: 'Posyp natką.' },
];

const detailsOf = (container: HTMLElement) => Array.from(container.querySelectorAll('details'));

describe('RecipeSteps', () => {
  it('opens only the first step by default', () => {
    const { container } = render(<RecipeSteps steps={steps} />);
    expect(detailsOf(container).map((d) => d.open)).toEqual([true, false, false]);
  });

  it('expands and collapses all steps from one control', () => {
    const { container } = render(<RecipeSteps steps={steps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Rozwiń wszystkie' }));
    expect(detailsOf(container).every((d) => d.open)).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Zwiń wszystkie' }));
    expect(detailsOf(container).some((d) => d.open)).toBe(false);
  });

  it('shows titles in summaries and renders an untitled step as a numbered card with its text', () => {
    render(<RecipeSteps steps={steps} />);
    expect(screen.getByText('Sos')).toBeTruthy();
    expect(screen.getByText('Podanie')).toBeTruthy();
    expect(screen.getByText('2.')).toBeTruthy();
    expect(screen.getByText('Wymieszaj całość.')).toBeTruthy();
  });

  it('has no expand control for a single step', () => {
    render(<RecipeSteps steps={[steps[1]]} />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('RecipeIngredients', () => {
  const list = [
    { id: 'i1', amount: 200, unit: 'g', raw_text: 'ryż', optional: false },
    { id: 'i2', amount: null, unit: null, raw_text: 'sól', optional: true },
  ];

  it('scales amounts with the servings stepper and leaves amountless rows alone', () => {
    render(<RecipeIngredients ingredients={list} baseServings={2} />);
    expect(screen.getByText('200 g')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Więcej porcji'));
    expect(screen.getByText('300 g')).toBeTruthy();
    expect(screen.getByText('sól')).toBeTruthy();
    expect(screen.getByText(/opcjonalnie/)).toBeTruthy();
  });

  it('does not go below one serving', () => {
    render(<RecipeIngredients ingredients={list} baseServings={1} />);
    expect((screen.getByLabelText('Mniej porcji') as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('RecipeCard', () => {
  const base = {
    id: 'r1',
    name: 'Zupa',
    servings_base: 4,
    prep_time_min: 30,
    source_author: 'Jadłonomia',
    diet_tags: ['wegetarianska'],
    allergens: ['nabial'],
    macros_per_serving: null,
  } as unknown as RecipeListItem;

  it('shows author, servings, chips and „brak danych makro" when macros are missing', () => {
    render(<RecipeCard recipe={base} />);
    expect(screen.getByText('Zupa')).toBeTruthy();
    expect(screen.getByText('Jadłonomia')).toBeTruthy();
    expect(screen.getByText('4 porcji')).toBeTruthy();
    expect(screen.getByText('Wegetariańska')).toBeTruthy();
    expect(screen.getByText('Zawiera: nabiał')).toBeTruthy();
    expect(screen.getByText('brak danych makro')).toBeTruthy();
  });

  it('shows per-serving macros and omits a missing author', () => {
    render(
      <RecipeCard
        recipe={{ ...base, source_author: null, macros_per_serving: { kcal: 420, protein: 20, fat: 10, carbs: 55 } }}
      />,
    );
    expect(screen.getByText(/420 kcal/)).toBeTruthy();
    expect(screen.queryByText('Jadłonomia')).toBeNull();
  });
});
