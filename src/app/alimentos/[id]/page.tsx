import Link from "next/link";
import { notFound } from "next/navigation";
import FoodForm from "@/components/FoodForm";
import { getFood, getFoodUsage } from "@/lib/data";
import { unitFields, type Food } from "@/lib/foods";

const SOURCES: Record<Food["source"], string> = {
  off: "Traído de Open Food Facts",
  catalog: "De la base de alimentos (USDA)",
  manual: "Cargado a mano",
};

export default async function FoodPage({ params }: PageProps<"/alimentos/[id]">) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [food, usage] = await Promise.all([getFood(id), getFoodUsage(id)]);
  if (!food) notFound();

  const text = (n: number | null) => (n === null ? "" : String(n).replace(".", ","));

  return (
    <div className="space-y-6">
      <div>
        <Link href="/alimentos" className="text-sm text-muted">
          ‹ Alimentos
        </Link>
        <h1 className="mt-3 text-2xl font-semibold">Editar alimento</h1>
        <p className="mt-1 text-sm text-muted">
          {SOURCES[food.source]}
          {usage.entries > 0 &&
            ` · ${usage.entries} ${usage.entries === 1 ? "registro" : "registros"} en el diario, que se recalculan si cambiás los valores`}
          {usage.meals > 0 && ` · en ${usage.meals} ${usage.meals === 1 ? "comida" : "comidas"}`}
        </p>
      </div>
      <FoodForm
        foodId={food.id}
        afterSave="/alimentos"
        canDelete={usage.entries === 0 && usage.meals === 0}
        initial={{
          barcode: food.barcode ?? "",
          name: food.name,
          brand: food.brand ?? "",
          unit: food.unit,
          kcal: text(food.kcal),
          protein: text(food.protein),
          carbs: text(food.carbs),
          fat: text(food.fat),
          units: unitFields(food.units),
        }}
      />
    </div>
  );
}
