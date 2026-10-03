import Link from "next/link";
import AddEntry from "@/components/AddEntry";
import { getFoods } from "@/lib/data";
import { dayKey, formatDayLabel, parseDayKey } from "@/lib/time";

export default async function AddPage({ searchParams }: PageProps<"/agregar">) {
  const params = await searchParams;
  const today = dayKey(new Date());
  const day = parseDayKey(params.d) ?? today;
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
        {day !== today && (
          <p className="text-sm text-muted first-letter:uppercase">{formatDayLabel(day, today)}</p>
        )}
      </div>
      <AddEntry
        key={initialFood?.id ?? "pick"}
        foods={foods}
        day={day}
        isToday={day === today}
        initialFood={initialFood}
      />
    </div>
  );
}
