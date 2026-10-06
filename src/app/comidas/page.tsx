import Link from "next/link";
import { getMeals } from "@/lib/data";
import { countFoods, formatKcal, totalOf } from "@/lib/foods";

export default async function MealsPage() {
  const meals = await getMeals();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Comidas</h1>
        <Link
          href="/comidas/nueva"
          className="rounded-2xl bg-accent px-4 py-2 text-sm font-medium text-white active:scale-95"
        >
          + Nueva
        </Link>
      </div>
      {meals.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-line px-4 py-5 text-center text-sm text-muted">
          Una comida es un grupo de alimentos con sus cantidades: una receta, o lo que desayunás
          siempre. La armás una vez y después la registrás de un toque.
        </p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-surface">
          {meals.map((meal) => (
            <li key={meal.id}>
              <Link
                href={`/comidas/${meal.id}`}
                className="flex items-center justify-between gap-3 px-4 py-3 active:bg-accent-soft"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{meal.name}</span>
                  <span className="block truncate text-xs text-muted">
                    {meal.items.map((item) => item.food.name).join(", ")}
                  </span>
                </span>
                <span className="tabular shrink-0 text-right text-xs text-muted">
                  <span className="block text-sm font-medium text-ink">
                    {formatKcal(totalOf(meal.items).kcal)} kcal
                  </span>
                  {countFoods(meal.items.length)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
