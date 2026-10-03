import Link from "next/link";
import { notFound } from "next/navigation";
import FoodForm from "@/components/FoodForm";
import { countEntriesOfFood, getFood } from "@/lib/data";

export default async function FoodPage({ params }: PageProps<"/alimentos/[id]">) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [food, entryCount] = await Promise.all([getFood(id), countEntriesOfFood(id)]);
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
          {food.source === "off" ? "Traído de Open Food Facts" : "Cargado a mano"}
          {entryCount > 0 &&
            ` · ${entryCount} ${entryCount === 1 ? "registro" : "registros"} en el diario, que se recalculan si cambiás los valores`}
        </p>
      </div>
      <FoodForm
        foodId={food.id}
        afterSave="/alimentos"
        canDelete={entryCount === 0}
        initial={{
          barcode: food.barcode ?? "",
          name: food.name,
          brand: food.brand ?? "",
          unit: food.unit,
          kcal: text(food.kcal),
          protein: text(food.protein),
          carbs: text(food.carbs),
          fat: text(food.fat),
          servingQuantity: text(food.servingQuantity),
        }}
      />
    </div>
  );
}
