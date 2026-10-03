// Types and nutrition math shared by server and client code.

export type Unit = "g" | "ml";

/** Nutrition values. On a Food they're per 100 g/ml; elsewhere, absolute. */
export type Macros = { kcal: number; protein: number; carbs: number; fat: number };

export type Food = Macros & {
  id: number;
  barcode: string | null;
  name: string;
  brand: string | null;
  source: "off" | "manual";
  unit: Unit;
  servingQuantity: number | null;
  /** Quantity of the most recent entry of this food, to start the form there. */
  lastQuantity: number | null;
};

export type Entry = {
  id: number;
  quantity: number;
  /** When it was eaten, ISO-8601 UTC. */
  eatenAt: string;
  food: Food;
};

/** What a quantity of a food adds up to. */
export function macrosFor(food: Macros, quantity: number): Macros {
  const factor = quantity / 100;
  return {
    kcal: food.kcal * factor,
    protein: food.protein * factor,
    carbs: food.carbs * factor,
    fat: food.fat * factor,
  };
}

export function sumMacros(list: Macros[]): Macros {
  return list.reduce(
    (acc, m) => ({
      kcal: acc.kcal + m.kcal,
      protein: acc.protein + m.protein,
      carbs: acc.carbs + m.carbs,
      fat: acc.fat + m.fat,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

/** Parses what was typed in a number field; accepts a decimal comma. */
export function parseDecimal(text: string): number | null {
  const trimmed = text.trim().replace(",", ".");
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

export function formatKcal(n: number): string {
  return Math.round(n).toLocaleString("es-AR");
}

/** Grams, millilitres or macros: at most one decimal. */
export function formatAmount(n: number): string {
  return n.toLocaleString("es-AR", { maximumFractionDigits: 1 });
}
