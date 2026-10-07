"use client";

import { useState, useTransition } from "react";
import { deleteEntry, updateEntry } from "@/app/actions";
import {
  draftOf,
  formatKcal,
  formatQuantity,
  macrosFor,
  quantityOf,
  type Entry,
} from "@/lib/foods";
import { formatTime, toLocalInputValue } from "@/lib/time";
import QuantityField from "./QuantityField";

/** A diary line. Tapping it opens the quantity and the date and time for editing. */
export default function EntryRow({ entry }: { entry: Entry }) {
  const { food } = entry;
  const [open, setOpen] = useState(false);
  const [quantity, setQuantity] = useState(() => draftOf(food, entry.quantity));
  const [eatenAt, setEatenAt] = useState(() => toLocalInputValue(new Date(entry.eatenAt)));
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
    const value = quantityOf(food, quantity);
    if (value === null) {
      setError("Cantidad inválida");
      return;
    }
    if (!eatenAt) {
      setError("Fecha inválida");
      return;
    }
    run(() => updateEntry(entry.id, { quantity: value, eatenAt: new Date(eatenAt).toISOString() }));
  }

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span className="tabular shrink-0 text-xs text-faint">{formatTime(entry.eatenAt)}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{food.name}</span>
          <span className="block truncate text-xs text-muted">
            {food.brand && `${food.brand} · `}
            {formatQuantity(food, entry.quantity)}
          </span>
        </span>
        <span className="tabular shrink-0 text-sm font-medium">
          {formatKcal(macrosFor(food, entry.quantity).kcal)} kcal
        </span>
      </button>

      {open && (
        <div className="space-y-3 px-4 pb-4">
          <QuantityField food={food} value={quantity} onChange={setQuantity} />
          <input
            type="datetime-local"
            value={eatenAt}
            onChange={(e) => setEatenAt(e.target.value)}
            aria-label="Fecha y hora"
            className="w-full rounded-2xl border border-line bg-bg px-3 py-2 text-base outline-none focus:border-accent"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className="flex-1 rounded-2xl bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
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
