'use client';

const DIETS = ['wegetarianska', 'ketogeniczna', 'bezglutenowa'];
const ALLERGENS = ['gluten', 'mieso', 'nabial', 'orzechy', 'ryby'];

export function RecipeFilters({
  diet, exclude, onDiet, onExclude,
}: {
  diet: string[]; exclude: string[];
  onDiet: (v: string[]) => void; onExclude: (v: string[]) => void;
}) {
  function toggle(list: string[], v: string, setter: (x: string[]) => void) {
    setter(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  }
  return (
    <div className="space-y-2 p-4 border-b">
      <div>
        <span className="text-sm font-semibold mr-2">Diety:</span>
        {DIETS.map((d) => (
          <label key={d} className="mr-3 text-sm">
            <input type="checkbox" checked={diet.includes(d)} onChange={() => toggle(diet, d, onDiet)} /> {d}
          </label>
        ))}
      </div>
      <div>
        <span className="text-sm font-semibold mr-2">Wyklucz:</span>
        {ALLERGENS.map((a) => (
          <label key={a} className="mr-3 text-sm">
            <input type="checkbox" checked={exclude.includes(a)} onChange={() => toggle(exclude, a, onExclude)} /> {a}
          </label>
        ))}
      </div>
    </div>
  );
}
