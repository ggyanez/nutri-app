import Link from "next/link";
import MealForm from "@/components/MealForm";
import { getFoods } from "@/lib/data";

export default async function NewMealPage() {
  const foods = await getFoods();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/comidas" className="text-sm text-muted">
          ‹ Comidas
        </Link>
        <h1 className="mt-3 text-2xl font-semibold">Nueva comida</h1>
      </div>
      <MealForm foods={foods} />
    </div>
  );
}
