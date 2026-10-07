"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { logEntry, logMeal } from "@/app/actions";
import {
  UNIT_KINDS,
  asUnits,
  countFoods,
  formatAmount,
  formatKcal,
  formatQuantity,
  macrosFor,
  parseDecimal,
  totalOf,
  type Food,
  type Macros,
  type Meal,
  type UnitKind,
} from "@/lib/foods";
import { searchBy } from "@/lib/search";
import { dayKey } from "@/lib/time";
import EatenAtField from "./EatenAtField";
import FoodPicker from "./FoodPicker";

const KINDS = [
  { id: "food", label: "Alimento" },
  { id: "meal", label: "Comida" },
] as const;

/**
 * Two steps: pick a food or a saved meal, then how much. `day` is the diary
 * day it was opened from; `isToday` says whether that's today, in which case
 * the entry is timestamped now.
 */
export default function AddEntry({
  foods,
  meals,
  day,
  isToday,
  initialFood,
}: {
  foods: Food[];
  meals: Meal[];
  day: string;
  isToday: boolean;
  initialFood: Food | null;
}) {
  const [kind, setKind] = useState<(typeof KINDS)[number]["id"]>("food");
  const [food, setFood] = useState<Food | null>(initialFood);
  const [meal, setMeal] = useState<Meal | null>(null);
  // Another day has no "now": start at noon and let the time be changed.
  const initialEatenAt = isToday ? null : `${day}T12:00`;

  if (food) {
    return (
      <QuantityForm
        key={food.id}
        food={food}
        initialEatenAt={initialEatenAt}
        onBack={() => setFood(null)}
      />
    );
  }
  if (meal) {
    return <MealLogForm meal={meal} initialEatenAt={initialEatenAt} onBack={() => setMeal(null)} />;
  }

  return (
    <div className="space-y-5">
      <div className="flex gap-1 rounded-2xl border border-line bg-surface p-1">
        {KINDS.map((k) => (
          <button
            key={k.id}
            type="button"
            onClick={() => setKind(k.id)}
            aria-pressed={kind === k.id}
            className={`flex-1 rounded-xl py-2 text-sm font-medium transition ${
              kind === k.id ? "bg-ink text-surface" : "text-muted"
            }`}
          >
            {k.label}
          </button>
        ))}
      </div>

      {kind === "food" ? (
        <FoodPicker
          foods={foods}
          onPick={setFood}
          newFoodHref={(barcode) =>
            `/alimentos/nuevo?d=${day}${barcode ? `&barcode=${barcode}` : ""}`
          }
        />
      ) : (
        <MealPicker meals={meals} onPick={setMeal} />
      )}
    </div>
  );
}

function MealPicker({ meals, onPick }: { meals: Meal[]; onPick: (meal: Meal) => void }) {
  const [query, setQuery] = useState("");
  const results = useMemo(
    () => searchBy(meals, query, (m) => ({ name: m.name })),
    [meals, query],
  );

  if (meals.length === 0) {
    return (
      <p className="rounded-3xl border border-dashed border-line px-4 py-5 text-center text-sm text-muted">
        Todavía no armaste ninguna comida.{" "}
        <Link href="/comidas/nueva" className="font-medium text-accent underline underline-offset-4">
          Armar una
        </Link>
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar comida…"
        className="w-full rounded-2xl border border-line bg-surface px-4 py-3 text-base outline-none placeholder:text-faint focus:border-accent"
      />
      {results.length === 0 ? (
        <p className="px-1 text-sm text-faint">Ninguna comida coincide.</p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-surface">
          {results.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => onPick(m)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left active:bg-accent-soft"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{m.name}</span>
                  <span className="block truncate text-xs text-muted">
                    {countFoods(m.items.length)}
                  </span>
                </span>
                <span className="tabular shrink-0 text-xs text-muted">
                  {formatKcal(totalOf(m.items).kcal)} kcal
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const COUNT_SHORTCUTS = [
  { label: "½", value: "0,5" },
  { label: "1", value: "1" },
  { label: "2", value: "2" },
  { label: "3", value: "3" },
];

/**
 * How much of a food: typed in g/ml, or counted in one of the food's units
 * (2 fetas, 1 envase). Either way what's logged is the amount in g/ml.
 */
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
  // Start where the last entry of this food left off: counted in a unit if
  // it was a round number of one, weighed otherwise. A food never logged
  // starts at one piece or serving — never at a whole package.
  const last =
    food.lastQuantity === null
      ? { unit: food.units.find((u) => u.kind === "unit" || u.kind === "serving"), count: 1 }
      : asUnits(food.units, food.lastQuantity);
  const [kind, setKind] = useState<UnitKind | null>(last?.unit?.kind ?? null);
  const [amount, setAmount] = useState(formatAmount(food.lastQuantity ?? 100));
  const [count, setCount] = useState(formatAmount(last?.unit ? last.count : 1));
  const [eatenAt, setEatenAt] = useState(initialEatenAt);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const unit = food.units.find((u) => u.kind === kind) ?? null;
  const typed = parseDecimal(unit ? count : amount);
  // What gets logged, in the food's g or ml.
  const value =
    typed === null || typed <= 0 ? null : Math.round(typed * (unit?.quantity ?? 1) * 10) / 10;
  const preview = macrosFor(food, value ?? 0);
  const amounts = [...new Set([100, food.lastQuantity].filter((n) => n !== null))];

  function submit() {
    if (value === null) {
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
        {food.units.length > 0 && (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Unidad">
            {[null, ...food.units].map((u) => (
              <button
                key={u?.kind ?? "amount"}
                type="button"
                onClick={() => setKind(u?.kind ?? null)}
                aria-pressed={kind === (u?.kind ?? null)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                  kind === (u?.kind ?? null) ? "bg-ink text-surface" : "border border-line text-muted"
                }`}
              >
                {u ? `${UNIT_KINDS[u.kind].one} · ${formatAmount(u.quantity)} ${food.unit}` : food.unit}
              </button>
            ))}
          </div>
        )}
        <label className="block">
          <span className="text-sm font-medium text-muted">
            {unit ? `Cantidad de ${UNIT_KINDS[unit.kind].many}` : `Cantidad (${food.unit})`}
          </span>
          <input
            // One field per way of counting, so switching keeps what was typed in each.
            key={kind ?? "amount"}
            value={unit ? count : amount}
            onChange={(e) => (unit ? setCount : setAmount)(e.target.value)}
            inputMode="decimal"
            autoFocus
            className="tabular mt-1 w-full rounded-2xl border border-line bg-bg px-4 py-3 text-2xl font-semibold outline-none focus:border-accent"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          {unit
            ? COUNT_SHORTCUTS.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setCount(s.value)}
                  className="min-w-12 rounded-full border border-line px-3 py-1.5 text-sm text-muted"
                >
                  {s.label}
                </button>
              ))
            : amounts.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setAmount(formatAmount(n))}
                  className="rounded-full border border-line px-3 py-1.5 text-sm text-muted"
                >
                  {formatAmount(n)} {food.unit}
                </button>
              ))}
        </div>
        <EatenAtField value={eatenAt} onChange={setEatenAt} />
        <div>
          {unit && value !== null && (
            <p className="tabular mb-3 text-sm text-muted">
              = {formatAmount(value)} {food.unit}
            </p>
          )}
          <Preview total={preview} />
        </div>
      </section>

      <SubmitButton pending={pending} error={error} onClick={submit} />
    </div>
  );
}

/** Logs a whole meal, or a part of it: every food is scaled by the portions. */
function MealLogForm({
  meal,
  initialEatenAt,
  onBack,
}: {
  meal: Meal;
  initialEatenAt: string | null;
  onBack: () => void;
}) {
  const router = useRouter();
  const [portions, setPortions] = useState("1");
  const [eatenAt, setEatenAt] = useState(initialEatenAt);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const value = parseDecimal(portions);
  const factor = value !== null && value > 0 ? value : 0;
  const scaled = meal.items.map((item) => ({ ...item, quantity: item.quantity * factor }));

  function submit() {
    if (value === null || value <= 0) {
      setError("Porciones inválidas");
      return;
    }
    setError(null);
    const when = eatenAt ? new Date(eatenAt) : new Date();
    startTransition(async () => {
      const res = await logMeal({ mealId: meal.id, portions: value, eatenAt: when.toISOString() });
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
          <h2 className="min-w-0 text-lg leading-snug font-semibold">{meal.name}</h2>
          <button type="button" onClick={onBack} className="shrink-0 text-sm font-medium text-accent">
            Cambiar
          </button>
        </div>
        <ul className="mt-3 space-y-1.5 text-sm">
          {scaled.map((item) => (
            <li key={item.food.id} className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate">{item.food.name}</span>
              <span className="tabular shrink-0 text-muted">
                {formatQuantity(item.food, item.quantity)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-4 rounded-3xl border border-line bg-surface px-5 py-5">
        <label className="block">
          <span className="text-sm font-medium text-muted">Porciones</span>
          <input
            value={portions}
            onChange={(e) => setPortions(e.target.value)}
            inputMode="decimal"
            className="tabular mt-1 w-full rounded-2xl border border-line bg-bg px-4 py-3 text-2xl font-semibold outline-none focus:border-accent"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          {COUNT_SHORTCUTS.slice(0, 3).map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => setPortions(s.value)}
              className="min-w-12 rounded-full border border-line px-3 py-1.5 text-sm text-muted"
            >
              {s.label}
            </button>
          ))}
        </div>
        <EatenAtField value={eatenAt} onChange={setEatenAt} />
        <Preview total={totalOf(scaled)} />
      </section>

      <SubmitButton pending={pending} error={error} onClick={submit} />
    </div>
  );
}

function Preview({ total }: { total: Macros }) {
  return (
    <p className="tabular border-t border-line pt-4 text-sm text-muted">
      <span className="text-2xl font-semibold text-ink">{formatKcal(total.kcal)}</span> kcal · P{" "}
      {formatAmount(total.protein)} g · C {formatAmount(total.carbs)} g · G {formatAmount(total.fat)}{" "}
      g
    </p>
  );
}

function SubmitButton({
  pending,
  error,
  onClick,
}: {
  pending: boolean;
  error: string | null;
  onClick: () => void;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="w-full rounded-3xl bg-accent py-4 text-lg font-medium text-white shadow-sm transition active:scale-[0.98] disabled:opacity-40"
      >
        {pending ? "Registrando…" : "Registrar"}
      </button>
      {error && <p className="mt-2 text-center text-sm text-danger">{error}</p>}
    </div>
  );
}
