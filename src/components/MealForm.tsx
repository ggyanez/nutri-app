"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteMeal, saveMeal } from "@/app/actions";
import {
  draftOf,
  formatAmount,
  formatKcal,
  quantityOf,
  totalOf,
  usualDraft,
  type Food,
  type Meal,
  type QuantityDraft,
} from "@/lib/foods";
import FoodPicker from "./FoodPicker";
import QuantityField from "./QuantityField";

type Item = { food: Food; quantity: QuantityDraft };

/**
 * Creates a meal, or edits `meal`: a name and a list of foods with their
 * quantities. Foods are added through the same picker as the diary, so they
 * can come from the user's own, the catalog or a barcode.
 */
export default function MealForm({ meal, foods }: { meal?: Meal; foods: Food[] }) {
  const router = useRouter();
  const [name, setName] = useState(meal?.name ?? "");
  const [items, setItems] = useState<Item[]>(
    () => meal?.items.map((i) => ({ food: i.food, quantity: draftOf(i.food, i.quantity) })) ?? [],
  );
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const total = totalOf(
    items.map((item) => ({ food: item.food, quantity: quantityOf(item.food, item.quantity) ?? 0 })),
  );

  function add(food: Food) {
    setPicking(false);
    // Picking a food that's already there changes nothing: its quantity is right below.
    if (items.some((item) => item.food.id === food.id)) return;
    setItems([...items, { food, quantity: usualDraft(food) }]);
  }

  function setQuantity(foodId: number, quantity: QuantityDraft) {
    setItems(items.map((item) => (item.food.id === foodId ? { ...item, quantity } : item)));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = items.map((item) => ({
      foodId: item.food.id,
      quantity: quantityOf(item.food, item.quantity),
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
                <li key={item.food.id} className="space-y-2 py-3 pr-2 pl-4">
                  <div className="flex items-start gap-2">
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 block leading-snug font-medium">
                        {item.food.name}
                      </span>
                      {item.food.brand && (
                        <span className="block truncate text-xs text-muted">{item.food.brand}</span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => setItems(items.filter((i) => i.food.id !== item.food.id))}
                      aria-label={`Quitar ${item.food.name}`}
                      className="-mt-1.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg text-faint active:bg-accent-soft"
                    >
                      ×
                    </button>
                  </div>
                  <QuantityField
                    food={item.food}
                    value={item.quantity}
                    onChange={(quantity) => setQuantity(item.food.id, quantity)}
                  />
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
