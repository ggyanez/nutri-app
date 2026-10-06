import Link from "next/link";
import FoodForm, { type FoodFormValues } from "@/components/FoodForm";
import { unitFields } from "@/lib/foods";
import { fetchOffProduct, type OffProduct } from "@/lib/off";
import { requireSession } from "@/lib/session";
import { parseDayKey } from "@/lib/time";

export default async function NewFoodPage({ searchParams }: PageProps<"/alimentos/nuevo">) {
  await requireSession();
  const params = await searchParams;
  const barcode = typeof params.barcode === "string" ? params.barcode.replace(/\D/g, "") : "";
  // Present when this page was reached while adding to the diary: go back
  // there afterwards, with the new food already picked.
  const day = parseDayKey(params.d);

  // Open Food Facts may know the product but not its whole nutrition table;
  // whatever it has is a head start.
  let known: OffProduct | null = null;
  let hint = "";
  if (barcode) {
    try {
      known = await fetchOffProduct(barcode);
      hint = known
        ? "Open Food Facts tiene algunos datos de este producto. Revisalos y completá lo que falte."
        : "Este código no está en Open Food Facts. Cargalo una vez y queda guardado.";
    } catch {
      hint = "No se pudo consultar Open Food Facts. Cargalo a mano y queda guardado.";
    }
  }

  const text = (n: number | null | undefined) => (n == null ? "" : String(n).replace(".", ","));
  const initial: FoodFormValues = {
    barcode,
    name: known?.name ?? "",
    brand: known?.brand ?? "",
    unit: known?.unit ?? "g",
    kcal: text(known?.kcal),
    protein: text(known?.protein),
    carbs: text(known?.carbs),
    fat: text(known?.fat),
    units: unitFields(known?.units ?? []),
  };

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={day ? `/agregar?d=${day}` : "/alimentos"}
          className="text-sm text-muted"
        >
          ‹ Volver
        </Link>
        <h1 className="mt-3 text-2xl font-semibold">Nuevo alimento</h1>
        {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
      </div>
      <FoodForm
        initial={initial}
        afterSave={day ? `/agregar?d=${day}&food=:id` : "/alimentos"}
      />
    </div>
  );
}
