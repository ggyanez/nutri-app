import Link from "next/link";
import AddEntry from "@/components/AddEntry";
import { getFoods } from "@/lib/data";
import { MEALS, isMeal } from "@/lib/foods";
import { dayKey, formatDayLabel, mealAt, parseDayKey } from "@/lib/time";

export default async function AddPage({ searchParams }: PageProps<"/agregar">) {
  const params = await searchParams;
  const now = new Date();
  const today = dayKey(now);
  const day = parseDayKey(params.d) ?? today;
  const meal = isMeal(params.meal) ? params.meal : mealAt(now);
  const foods = await getFoods();
  // Set when coming back from creating a food: skip straight to the quantity.
  const initialFood = foods.find((f) => String(f.id) === params.food) ?? null;

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/?d=${day}`} className="text-sm text-muted">
          ‹ Diario
        </Link>
        <h1 className="mt-3 text-2xl font-semibold">Agregar</h1>
        <p className="text-sm text-muted">
          <span className="inline-block first-letter:uppercase">{formatDayLabel(day, today)}</span>
          {" · "}
          {MEALS.find((m) => m.id === meal)?.label}
        </p>
      </div>
      <AddEntry
        key={initialFood?.id ?? "pick"}
        foods={foods}
        day={day}
        meal={meal}
        initialFood={initialFood}
      />
    </div>
  );
}
