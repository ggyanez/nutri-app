"use client";

import { useState, useTransition } from "react";
import { deleteGroup, updateGroup } from "@/app/actions";
import {
  countFoods,
  formatAmount,
  formatKcal,
  macrosFor,
  parseDecimal,
  totalOf,
  type Entry,
} from "@/lib/foods";
import { formatTime, toLocalInputValue } from "@/lib/time";

/**
 * A meal in the diary: the entries that were logged together, shown as one
 * line. Tapping it opens each food's quantity and the date and time.
 */
export default function MealGroupRow({ name, entries }: { name: string; entries: Entry[] }) {
  const { eatenAt, group } = entries[0];
  const [open, setOpen] = useState(false);
  const [quantities, setQuantities] = useState(() =>
    Object.fromEntries(entries.map((e) => [e.id, formatAmount(e.quantity)])),
  );
  const [when, setWhen] = useState(() => toLocalInputValue(new Date(eatenAt)));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: () => ReturnType<typeof deleteGroup>) {
    setError(null);
    startTransition(async () => {
      const res = await action();
      if (!res.ok) setError(res.error);
    });
  }

  function save() {
    if (!group) return;
    if (!when) {
      setError("Fecha inválida");
      return;
    }
    const items = entries.map((e) => ({ id: e.id, quantity: parseDecimal(quantities[e.id]) }));
    if (items.some((item) => item.quantity !== null && item.quantity < 0)) {
      setError("Revisá las cantidades");
      return;
    }
    run(() => updateGroup(group.id, { eatenAt: new Date(when).toISOString(), items }));
  }

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span className="tabular shrink-0 text-xs text-faint">{formatTime(eatenAt)}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{name}</span>
          <span className="block truncate text-xs text-muted">
            {countFoods(entries.length)} · {entries.map((e) => e.food.name).join(", ")}
          </span>
        </span>
        <span className="tabular shrink-0 text-sm font-medium">
          {formatKcal(totalOf(entries).kcal)} kcal
        </span>
      </button>

      {open && (
        <div className="space-y-3 px-4 pb-4">
          <ul className="space-y-2">
            {entries.map((e) => (
              <li key={e.id} className="flex items-center gap-2">
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 block text-sm leading-snug">{e.food.name}</span>
                  <span className="tabular block text-xs text-muted">
                    {formatKcal(macrosFor(e.food, e.quantity).kcal)} kcal
                  </span>
                </span>
                <input
                  value={quantities[e.id]}
                  onChange={(ev) => setQuantities({ ...quantities, [e.id]: ev.target.value })}
                  inputMode="decimal"
                  aria-label={`Cantidad de ${e.food.name} en ${e.food.unit}`}
                  className="tabular w-20 rounded-xl border border-line bg-bg px-2 py-2 text-right text-base outline-none focus:border-accent"
                />
                <span className="w-5 text-sm text-muted">{e.food.unit}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-faint">Dejá un alimento en 0 para sacarlo de este registro.</p>
          <input
            type="datetime-local"
            value={when}
            onChange={(ev) => setWhen(ev.target.value)}
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
              onClick={() => group && run(() => deleteGroup(group.id))}
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
