import Link from "next/link";
import FoodList from "@/components/FoodList";
import { getFoods } from "@/lib/data";

export default async function FoodsPage() {
  const foods = await getFoods();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Alimentos</h1>
        <Link
          href="/alimentos/nuevo"
          className="rounded-2xl bg-accent px-4 py-2 text-sm font-medium text-white active:scale-95"
        >
          + Nuevo
        </Link>
      </div>
      {foods.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-line px-4 py-5 text-center text-sm text-muted">
          Acá queda guardado cada alimento que escanees o cargues a mano.
        </p>
      ) : (
        <FoodList foods={foods} />
      )}
    </div>
  );
}
