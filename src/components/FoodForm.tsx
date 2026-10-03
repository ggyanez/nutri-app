"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteFood, saveFood } from "@/app/actions";
import { parseDecimal, type Unit } from "@/lib/foods";

export type FoodFormValues = {
  barcode: string;
  name: string;
  brand: string;
  unit: Unit;
  kcal: string;
  protein: string;
  carbs: string;
  fat: string;
  servingQuantity: string;
};

const NUTRIENTS = [
  { field: "kcal", label: "Calorías", suffix: "kcal" },
  { field: "protein", label: "Proteínas", suffix: "g" },
  { field: "carbs", label: "Carbohidratos", suffix: "g" },
  { field: "fat", label: "Grasas", suffix: "g" },
] as const;

const INPUT =
  "w-full rounded-2xl border border-line bg-bg px-4 py-3 text-base outline-none placeholder:text-faint focus:border-accent";

/**
 * Creates a food, or edits the one in `foodId`. `afterSave` is where to go
 * next; the saved food's id replaces ":id" in it.
 */
export default function FoodForm({
  initial,
  foodId,
  afterSave,
  canDelete = false,
}: {
  initial: FoodFormValues;
  foodId?: number;
  afterSave: string;
  canDelete?: boolean;
}) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const set = (field: keyof FoodFormValues) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues({ ...values, [field]: e.target.value });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await saveFood(
        {
          barcode: values.barcode,
          name: values.name,
          brand: values.brand,
          unit: values.unit,
          kcal: parseDecimal(values.kcal),
          protein: parseDecimal(values.protein),
          carbs: parseDecimal(values.carbs),
          fat: parseDecimal(values.fat),
          servingQuantity: parseDecimal(values.servingQuantity),
        },
        foodId,
      );
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push(afterSave.replace(":id", String(res.data.id)));
    });
  }

  function remove() {
    if (foodId === undefined) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteFood(foodId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push("/alimentos");
    });
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <section className="space-y-3 rounded-3xl border border-line bg-surface px-5 py-5">
        <Field label="Nombre">
          <input value={values.name} onChange={set("name")} className={INPUT} />
        </Field>
        <Field label="Marca (opcional)">
          <input value={values.brand} onChange={set("brand")} className={INPUT} />
        </Field>
        <Field label="Código de barras (opcional)">
          <input
            value={values.barcode}
            onChange={set("barcode")}
            inputMode="numeric"
            className={`${INPUT} tabular`}
          />
        </Field>
      </section>

      <section className="space-y-3 rounded-3xl border border-line bg-surface px-5 py-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium text-muted">Valores cada 100 {values.unit}</h2>
          <div className="flex gap-1.5">
            {(["g", "ml"] as const).map((unit) => (
              <button
                key={unit}
                type="button"
                onClick={() => setValues({ ...values, unit })}
                className={`rounded-full px-3 py-1 text-sm font-medium ${
                  values.unit === unit ? "bg-ink text-surface" : "border border-line text-muted"
                }`}
              >
                {unit}
              </button>
            ))}
          </div>
        </div>
        <p className="text-xs text-faint">
          Fijate que la tabla del envase suele traer dos columnas: copiá la de 100 {values.unit}, no
          la de la porción.
        </p>
        <div className="grid grid-cols-2 gap-3">
          {NUTRIENTS.map((n) => (
            <Field key={n.field} label={`${n.label} (${n.suffix})`}>
              <input
                value={values[n.field]}
                onChange={set(n.field)}
                inputMode="decimal"
                className={`${INPUT} tabular`}
              />
            </Field>
          ))}
        </div>
        <Field label={`Porción en ${values.unit} (opcional)`}>
          <input
            value={values.servingQuantity}
            onChange={set("servingQuantity")}
            inputMode="decimal"
            className={`${INPUT} tabular`}
          />
        </Field>
      </section>

      <div className="space-y-3">
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-3xl bg-accent py-4 text-lg font-medium text-white shadow-sm transition active:scale-[0.98] disabled:opacity-40"
        >
          {pending ? "Guardando…" : "Guardar"}
        </button>
        {canDelete && (
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            className="w-full rounded-3xl border border-line py-3 font-medium text-danger disabled:opacity-40"
          >
            Borrar alimento
          </button>
        )}
        {error && <p className="text-center text-sm text-danger">{error}</p>}
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm text-muted">{label}</span>
      {children}
    </label>
  );
}
