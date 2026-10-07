"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteFood, saveFood } from "@/app/actions";
import {
  UNIT_KINDS,
  UNIT_KIND_LIST,
  parseDecimal,
  type FoodUnit,
  type Unit,
  type UnitKind,
} from "@/lib/foods";

export type FoodFormValues = {
  barcode: string;
  name: string;
  brand: string;
  unit: Unit;
  kcal: string;
  protein: string;
  carbs: string;
  fat: string;
  /** How much one of each is, as typed; empty for the ones the food doesn't have. */
  units: Record<UnitKind, string>;
};

const NUTRIENTS = [
  { field: "kcal", label: "Calorías", suffix: "kcal" },
  { field: "protein", label: "Proteínas", suffix: "g" },
  { field: "carbs", label: "Carbohidratos", suffix: "g" },
  { field: "fat", label: "Grasas", suffix: "g" },
] as const;

// Enter on any field just means "done typing".
function closeKeyboardOnEnter(e: React.KeyboardEvent) {
  if (e.key === "Enter" && e.target instanceof HTMLInputElement) e.target.blur();
}

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
  // The units with a field on screen: the ones the food has, or the two a
  // package label always states when it has none yet.
  const [shown, setShown] = useState<UnitKind[]>(() => {
    const filled = UNIT_KIND_LIST.filter((kind) => initial.units[kind].trim() !== "");
    return filled.length > 0 ? filled : ["serving", "package"];
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const setUnit = (kind: UnitKind, text: string) =>
    setValues({ ...values, units: { ...values.units, [kind]: text } });

  const set =
    (field: Exclude<keyof FoodFormValues, "units">) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setValues({ ...values, [field]: e.target.value });

  function save() {
    setError(null);
    const units: FoodUnit[] = [];
    for (const kind of UNIT_KIND_LIST) {
      if (values.units[kind].trim() === "") continue;
      const quantity = parseDecimal(values.units[kind]);
      if (quantity === null || quantity <= 0) {
        setError(`${UNIT_KINDS[kind].one}: ingresá cuánto es`);
        return;
      }
      units.push({ kind, quantity });
    }
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
          units,
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
    // Not a <form> on purpose: the keyboard's Enter / "Go" key on a field would
    // save the food halfway through.
    <div className="space-y-6" onKeyDown={closeKeyboardOnEnter}>
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
      </section>

      <section className="space-y-3 rounded-3xl border border-line bg-surface px-5 py-5">
        <h2 className="text-sm font-medium text-muted">Unidades</h2>
        <p className="text-xs text-faint">
          Para registrarlo sin pesar: cuánto es una de cada una. El envase es todo lo que trae (una
          lata, un pote); si el líquido se tira, poné el peso escurrido.
        </p>
        <ul className="space-y-2">
          {UNIT_KIND_LIST.filter((kind) => shown.includes(kind)).map((kind) => (
            <li key={kind} className="flex items-center gap-2">
              <label htmlFor={`unit-${kind}`} className="min-w-0 flex-1 text-sm">
                1 {UNIT_KINDS[kind].one} =
              </label>
              <input
                id={`unit-${kind}`}
                value={values.units[kind]}
                onChange={(e) => setUnit(kind, e.target.value)}
                inputMode="decimal"
                className="tabular w-24 rounded-xl border border-line bg-bg px-3 py-2 text-right text-base outline-none focus:border-accent"
              />
              <span className="w-5 text-sm text-muted">{values.unit}</span>
              <button
                type="button"
                onClick={() => {
                  setUnit(kind, "");
                  setShown(shown.filter((k) => k !== kind));
                }}
                aria-label={`Quitar ${UNIT_KINDS[kind].one}`}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg text-faint active:bg-accent-soft"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
        {shown.length < UNIT_KIND_LIST.length && (
          <select
            value=""
            onChange={(e) => setShown([...shown, e.target.value as UnitKind])}
            aria-label="Agregar unidad"
            className="w-full rounded-2xl border border-line bg-bg px-3 py-2.5 text-base text-accent outline-none focus:border-accent"
          >
            <option value="">+ Agregar unidad…</option>
            {UNIT_KIND_LIST.filter((kind) => !shown.includes(kind)).map((kind) => (
              <option key={kind} value={kind}>
                {UNIT_KINDS[kind].one}
              </option>
            ))}
          </select>
        )}
      </section>

      <div className="space-y-3">
        <button
          type="button"
          onClick={save}
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
    </div>
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
