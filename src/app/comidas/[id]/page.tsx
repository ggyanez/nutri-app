import Link from "next/link";
import { notFound } from "next/navigation";
import MealForm from "@/components/MealForm";
import { getFoods, getMeal } from "@/lib/data";

export default async function MealPage({ params }: PageProps<"/comidas/[id]">) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [meal, foods] = await Promise.all([getMeal(id), getFoods()]);
  if (!meal) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/comidas" className="text-sm text-muted">
          ‹ Comidas
        </Link>
        <h1 className="mt-3 text-2xl font-semibold">Editar comida</h1>
        <p className="mt-1 text-sm text-muted">
          Los cambios valen para lo que registres de acá en más: lo que ya está en el diario no se
          toca.
        </p>
      </div>
      <MealForm meal={meal} foods={foods} />
    </div>
  );
}
