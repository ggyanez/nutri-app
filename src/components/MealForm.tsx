"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteMeal, saveMeal } from "@/app/actions";
import {
  formatAmount,
  formatKcal,
  parseDecimal,
  totalOf,
  type Food,
  type Meal,
} from "@/lib/foods";
import FoodPicker from "./FoodPicker";

type Item = { food: Food; quantity: string };

/**
 * Creates a meal, or edits `meal`: a name and a list of foods with their
 * quantities. Foods are added through the same picker as the diary, so they
 * can come from the user's own, the catalog or a barcode.
 */
export default function MealForm({ meal, foods }: { meal?: Meal; foods: Food[] }) {
  const router = useRouter();
  const [name, setName] = useState(meal?.name ?? "");
  const [items, setItems] = useState<Item[]>(
    () => meal?.items.map((i) => ({ food: i.food, quantity: formatAmount(i.quantity) })) ?? [],
  );
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const total = totalOf(
    items.map((item) => ({ food: item.food, quantity: parseDecimal(item.quantity) ?? 0 })),
  );

  function add(food: Food) {
    setPicking(false);
    // Picking a food that's already there changes nothing: its quantity is right below.
    if (items.some((item) => item.food.id === food.id)) return;
    setItems([...items, { food, quantity: formatAmount(food.servingQuantity ?? 100) }]);
  }

  function setQuantity(foodId: number, quantity: string) {
    setItems(items.map((item) => (item.food.id === foodId ? { ...item, quantity } : item)));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = items.map((item) => ({
      foodId: item.food.id,
      quantity: parseDecimal(item.quantity),
    }));
    if (parsed.some((item) => item.quantity === null || item.quantity <= 0)) {
      setError("Revisá las cantidades");
      return;
    }
    startTransition(async () => {
      const res = await saveMeal(
        { name, items: parsed as { foodId: number; quantity: number }[] },
        meal?.id,
      );
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push("/comidas");
    });
  }

  function remove() {
    if (!meal) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteMeal(meal.id);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push("/comidas");
    });
  }

  if (picking) {
    return (
      <div className="space-y-5">
        <button type="button" onClick={() => setPicking(false)} className="text-sm text-muted">
          ‹ Volver a la comida
        </button>
        <FoodPicker foods={foods} onPick={add} />
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <section className="rounded-3xl border border-line bg-surface px-5 py-5">
        <label className="block">
          <span className="mb-1 block text-sm text-muted">Nombre</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Milanesa con puré, desayuno de siempre…"
            className="w-full rounded-2xl border border-line bg-bg px-4 py-3 text-base outline-none placeholder:text-faint focus:border-accent"
          />
        </label>
      </section>

      <section className="space-y-2">
        <h2 className="px-1 text-sm font-medium text-muted">Alimentos</h2>
        <div className="overflow-hidden rounded-3xl border border-line bg-surface">
          {items.length > 0 && (
            <ul className="divide-y divide-line border-b border-line">
              {items.map((item) => (
                <li key={item.food.id} className="flex items-center gap-2 px-4 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 block leading-snug font-medium">{item.food.name}</span>
                    {item.food.brand && (
                      <span className="block truncate text-xs text-muted">{item.food.brand}</span>
                    )}
                  </span>
                  <input
                    value={item.quantity}
                    onChange={(e) => setQuantity(item.food.id, e.target.value)}
                    inputMode="decimal"
                    aria-label={`Cantidad de ${item.food.name} en ${item.food.unit}`}
                    className="tabular w-20 rounded-xl border border-line bg-bg px-2 py-2 text-right text-base outline-none focus:border-accent"
                  />
                  <span className="w-5 text-sm text-muted">{item.food.unit}</span>
                  <button
                    type="button"
                    onClick={() => setItems(items.filter((i) => i.food.id !== item.food.id))}
                    aria-label={`Quitar ${item.food.name}`}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg text-faint active:bg-accent-soft"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={() => setPicking(true)}
            className="block w-full px-4 py-3 text-left text-sm font-medium text-accent active:bg-accent-soft"
          >
            + Agregar alimento
          </button>
        </div>
        {items.length > 0 && (
          <p className="tabular px-1 text-sm text-muted">
            Total: <span className="font-semibold text-ink">{formatKcal(total.kcal)} kcal</span> · P{" "}
            {formatAmount(total.protein)} g · C {formatAmount(total.carbs)} g · G{" "}
            {formatAmount(total.fat)} g
          </p>
        )}
      </section>

      <div className="space-y-3">
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-3xl bg-accent py-4 text-lg font-medium text-white shadow-sm transition active:scale-[0.98] disabled:opacity-40"
        >
          {pending ? "Guardando…" : "Guardar"}
        </button>
        {meal && (
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            className="w-full rounded-3xl border border-line py-3 font-medium text-danger disabled:opacity-40"
          >
            Borrar comida
          </button>
        )}
        {error && <p className="text-center text-sm text-danger">{error}</p>}
      </div>
    </form>
  );
}
