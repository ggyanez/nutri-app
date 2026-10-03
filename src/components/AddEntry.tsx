"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { logEntry, lookupBarcode } from "@/app/actions";
import { formatAmount, formatKcal, macrosFor, parseDecimal, type Food } from "@/lib/foods";
import { normalize } from "@/lib/search";
import { dayKey } from "@/lib/time";
import BarcodeScanner from "./BarcodeScanner";
import EatenAtField from "./EatenAtField";

const MAX_RESULTS = 30;

/**
 * Two steps: pick a food (scan, type a barcode, or search mine), then how
 * much. `day` is the diary day it was opened from; `isToday` says whether
 * that's today, in which case the entry is timestamped now.
 */
export default function AddEntry({
  foods,
  day,
  isToday,
  initialFood,
}: {
  foods: Food[];
  day: string;
  isToday: boolean;
  initialFood: Food | null;
}) {
  const router = useRouter();
  const [food, setFood] = useState<Food | null>(initialFood);
  const [scanning, setScanning] = useState(false);
  const [code, setCode] = useState("");
  const [query, setQuery] = useState("");
  // A barcode that couldn't be resolved: the way out is typing the food in.
  const [failed, setFailed] = useState<{ message: string; barcode: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const newFoodHref = (barcode?: string) =>
    `/alimentos/nuevo?d=${day}${barcode ? `&barcode=${barcode}` : ""}`;

  const results = useMemo(() => {
    const q = normalize(query);
    const matches = q
      ? foods.filter((f) => normalize(`${f.name} ${f.brand ?? ""}`).includes(q))
      : foods;
    return matches.slice(0, MAX_RESULTS);
  }, [foods, query]);

  function lookup(raw: string) {
    setScanning(false);
    setFailed(null);
    startTransition(async () => {
      const res = await lookupBarcode(raw);
      if (!res.ok) {
        setFailed({ message: res.error, barcode: raw.replace(/\D/g, "") });
      } else if (res.data.food) {
        setCode("");
        setFood(res.data.food);
      } else {
        router.push(newFoodHref(res.data.barcode));
      }
    });
  }

  if (food) {
    return (
      <QuantityForm
        key={food.id}
        food={food}
        // Another day has no "now": start at noon and let the time be changed.
        initialEatenAt={isToday ? null : `${day}T12:00`}
        onBack={() => setFood(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <button
          type="button"
          onClick={() => setScanning(true)}
          disabled={pending}
          className="w-full rounded-3xl bg-accent py-4 text-lg font-medium text-white shadow-sm transition active:scale-[0.98] disabled:opacity-60"
        >
          {pending ? "Buscando…" : "Escanear código de barras"}
        </button>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            lookup(code);
          }}
          className="flex gap-2"
        >
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            placeholder="…o escribí el código"
            className="tabular min-w-0 flex-1 rounded-2xl border border-line bg-surface px-4 py-3 text-base outline-none placeholder:text-faint focus:border-accent"
          />
          <button
            type="submit"
            disabled={pending || code.trim() === ""}
            className="rounded-2xl border border-line bg-surface px-4 font-medium text-accent disabled:opacity-40"
          >
            Buscar
          </button>
        </form>
        {failed && (
          <p className="text-sm text-danger">
            {failed.message}.{" "}
            <Link href={newFoodHref(failed.barcode)} className="underline underline-offset-4">
              Cargarlo a mano
            </Link>
          </p>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between px-1">
          <h2 className="text-sm font-medium text-muted">Mis alimentos</h2>
          <Link href={newFoodHref()} className="text-sm font-medium text-accent">
            + Nuevo
          </Link>
        </div>
        {foods.length > 0 && (
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar…"
            className="w-full rounded-2xl border border-line bg-surface px-4 py-3 text-base outline-none placeholder:text-faint focus:border-accent"
          />
        )}
        {results.length > 0 ? (
          <ul className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-surface">
            {results.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  onClick={() => setFood(f)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left active:bg-accent-soft"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{f.name}</span>
                    {f.brand && <span className="block truncate text-xs text-muted">{f.brand}</span>}
                  </span>
                  <span className="tabular shrink-0 text-xs text-muted">
                    {formatKcal(f.kcal)} kcal / 100 {f.unit}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-3xl border border-dashed border-line px-4 py-5 text-center text-sm text-muted">
            {foods.length === 0
              ? "Todavía no tenés alimentos. Escaneá un envase o cargá uno a mano."
              : "Ningún alimento coincide."}
          </p>
        )}
      </section>

      {scanning && <BarcodeScanner onDetect={lookup} onClose={() => setScanning(false)} />}
    </div>
  );
}

function QuantityForm({
  food,
  initialEatenAt,
  onBack,
}: {
  food: Food;
  /** A `datetime-local` value, or null for "now". */
  initialEatenAt: string | null;
  onBack: () => void;
}) {
  const router = useRouter();
  const [quantity, setQuantity] = useState(
    formatAmount(food.lastQuantity ?? food.servingQuantity ?? 100),
  );
  const [eatenAt, setEatenAt] = useState(initialEatenAt);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const value = parseDecimal(quantity);
  const preview = macrosFor(food, value !== null && value > 0 ? value : 0);
  const shortcuts = [
    ...new Set([food.servingQuantity, 100, food.lastQuantity].filter((n) => n !== null)),
  ];

  function submit() {
    if (value === null || value <= 0) {
      setError("Cantidad inválida");
      return;
    }
    setError(null);
    const when = eatenAt ? new Date(eatenAt) : new Date();
    startTransition(async () => {
      const res = await logEntry({ foodId: food.id, quantity: value, eatenAt: when.toISOString() });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push(`/?d=${dayKey(when)}`);
    });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-line bg-surface px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg leading-snug font-semibold">{food.name}</h2>
            {food.brand && <p className="text-sm text-muted">{food.brand}</p>}
          </div>
          <button type="button" onClick={onBack} className="shrink-0 text-sm font-medium text-accent">
            Cambiar
          </button>
        </div>
        <p className="tabular mt-2 text-xs text-muted">
          Cada 100 {food.unit}: {formatKcal(food.kcal)} kcal · P {formatAmount(food.protein)} · C{" "}
          {formatAmount(food.carbs)} · G {formatAmount(food.fat)}
        </p>
      </section>

      <section className="space-y-4 rounded-3xl border border-line bg-surface px-5 py-5">
        <label className="block">
          <span className="text-sm font-medium text-muted">Cantidad ({food.unit})</span>
          <input
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            inputMode="decimal"
            autoFocus
            className="tabular mt-1 w-full rounded-2xl border border-line bg-bg px-4 py-3 text-2xl font-semibold outline-none focus:border-accent"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          {shortcuts.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setQuantity(formatAmount(n))}
              className="rounded-full border border-line px-3 py-1.5 text-sm text-muted"
            >
              {n === food.servingQuantity ? "1 porción · " : ""}
              {formatAmount(n)} {food.unit}
            </button>
          ))}
        </div>
        <EatenAtField value={eatenAt} onChange={setEatenAt} />
        <p className="tabular border-t border-line pt-4 text-sm text-muted">
          <span className="text-2xl font-semibold text-ink">{formatKcal(preview.kcal)}</span> kcal · P{" "}
          {formatAmount(preview.protein)} g · C {formatAmount(preview.carbs)} g · G{" "}
          {formatAmount(preview.fat)} g
        </p>
      </section>

      <div>
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="w-full rounded-3xl bg-accent py-4 text-lg font-medium text-white shadow-sm transition active:scale-[0.98] disabled:opacity-40"
        >
          {pending ? "Registrando…" : "Registrar"}
        </button>
        {error && <p className="mt-2 text-center text-sm text-danger">{error}</p>}
      </div>
    </div>
  );
}
