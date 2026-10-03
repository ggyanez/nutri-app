"use client";

import { useState, useTransition } from "react";
import { deleteEntry, updateEntry } from "@/app/actions";
import {
  MEALS,
  formatAmount,
  formatKcal,
  macrosFor,
  parseDecimal,
  type Entry,
  type Meal,
} from "@/lib/foods";

/** A diary line. Tapping it opens the quantity and meal for editing. */
export default function EntryRow({ entry }: { entry: Entry }) {
  const { food } = entry;
  const [open, setOpen] = useState(false);
  const [quantity, setQuantity] = useState(formatAmount(entry.quantity));
  const [meal, setMeal] = useState<Meal>(entry.meal);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: () => ReturnType<typeof deleteEntry>) {
    setError(null);
    startTransition(async () => {
      const res = await action();
      if (!res.ok) setError(res.error);
    });
  }

  function save() {
    const value = parseDecimal(quantity);
    if (value === null) {
      setError("Cantidad inválida");
      return;
    }
    run(() => updateEntry(entry.id, { quantity: value, meal }));
  }

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="min-w-0">
          <span className="block truncate font-medium">{food.name}</span>
          <span className="block truncate text-xs text-muted">
            {food.brand && `${food.brand} · `}
            {formatAmount(entry.quantity)} {food.unit}
          </span>
        </span>
        <span className="tabular shrink-0 text-sm font-medium">
          {formatKcal(macrosFor(food, entry.quantity).kcal)} kcal
        </span>
      </button>

      {open && (
        <div className="space-y-3 px-4 pb-4">
          <div className="flex flex-wrap gap-2">
            {MEALS.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMeal(m.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                  meal === m.id ? "bg-ink text-surface" : "border border-line text-muted"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              inputMode="decimal"
              aria-label={`Cantidad en ${food.unit}`}
              className="tabular w-24 rounded-2xl border border-line bg-bg px-3 py-2 text-base outline-none focus:border-accent"
            />
            <span className="text-sm text-muted">{food.unit}</span>
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className="ml-auto rounded-2xl bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              Guardar
            </button>
            <button
              type="button"
              onClick={() => run(() => deleteEntry(entry.id))}
              disabled={pending}
              className="rounded-2xl border border-line px-4 py-2 text-sm font-medium text-danger disabled:opacity-60"
            >
              Borrar
            </button>
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
        </div>
      )}
    </li>
  );
}
