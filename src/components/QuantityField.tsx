"use client";

import {
  formatAmount,
  quantityOf,
  unitName,
  type Food,
  type QuantityDraft,
  type UnitKind,
} from "@/lib/foods";

/** For fields where the keyboard's Enter key should just mean "done typing": it closes the keyboard. */
export function blurOnEnter(e: React.KeyboardEvent<HTMLInputElement>) {
  if (e.key === "Enter") e.currentTarget.blur();
}

/**
 * A compact quantity of a food for rows and lists: a number and, when the
 * food can be counted, what it's a number of (g, fetas, envases…).
 * Changing the unit keeps the amount: 125 g becomes 1 envase.
 */
export default function QuantityField({
  food,
  value,
  onChange,
}: {
  food: Pick<Food, "name" | "unit" | "units">;
  value: QuantityDraft;
  onChange: (value: QuantityDraft) => void;
}) {
  const quantity = quantityOf(food, value);

  function changeKind(kind: UnitKind | null) {
    const size = food.units.find((u) => u.kind === kind)?.quantity ?? 1;
    onChange({ kind, text: quantity === null ? value.text : formatAmount(quantity / size) });
  }

  return (
    <span className="flex items-center gap-2">
      <input
        value={value.text}
        onChange={(e) => onChange({ ...value, text: e.target.value })}
        inputMode="decimal"
        enterKeyHint="done"
        onKeyDown={blurOnEnter}
        aria-label={`Cantidad de ${food.name}`}
        className="tabular w-20 rounded-xl border border-line bg-bg px-2 py-2 text-right text-base outline-none focus:border-accent"
      />
      {food.units.length === 0 ? (
        <span className="text-sm text-muted">{food.unit}</span>
      ) : (
        <>
          <select
            value={value.kind ?? ""}
            onChange={(e) => changeKind((e.target.value || null) as UnitKind | null)}
            aria-label={`Unidad de ${food.name}`}
            className="rounded-xl border border-line bg-bg px-2 py-2 text-base text-ink outline-none focus:border-accent"
          >
            <option value="">{food.unit}</option>
            {food.units.map((u) => (
              <option key={u.kind} value={u.kind}>
                {unitName(u.kind, food.units, true)}
              </option>
            ))}
          </select>
          {value.kind && quantity !== null && (
            <span className="tabular text-sm text-muted">
              = {formatAmount(quantity)} {food.unit}
            </span>
          )}
        </>
      )}
    </span>
  );
}
