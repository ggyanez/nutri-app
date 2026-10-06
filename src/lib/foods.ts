// Types and nutrition math shared by server and client code.

export type Unit = "g" | "ml";

/**
 * Ways to count a food instead of weighing it, with their names in singular
 * and plural. The order is the one they're offered in, and the one a
 * quantity is read back in ("2 fetas" rather than "1 porción").
 */
export const UNIT_KINDS = {
  unit: { one: "unidad", many: "unidades" },
  slice: { one: "feta", many: "fetas" },
  breadSlice: { one: "rebanada", many: "rebanadas" },
  serving: { one: "porción", many: "porciones" },
  // The whole package: a can, a pot, a bottle.
  package: { one: "envase", many: "envases" },
} as const;

export type UnitKind = keyof typeof UNIT_KINDS;
export const UNIT_KIND_LIST = Object.keys(UNIT_KINDS) as UnitKind[];

/** One of a food's units and how much it is, in g or ml. */
export type FoodUnit = { kind: UnitKind; quantity: number };

/** Nutrition values. On a Food they're per 100 g/ml; elsewhere, absolute. */
export type Macros = { kcal: number; protein: number; carbs: number; fat: number };

export type Food = Macros & {
  id: number;
  barcode: string | null;
  name: string;
  brand: string | null;
  /** Open Food Facts, typed in by hand, or the built-in catalog. */
  source: "off" | "manual" | "catalog";
  /** The catalog entry it was copied from, if any. */
  catalogKey: string | null;
  unit: Unit;
  /** At most one per kind, in the order of UNIT_KINDS. */
  units: FoodUnit[];
  /** Quantity of the most recent entry of this food, to start the form there. */
  lastQuantity: number | null;
};

/** A generic food of the built-in catalog (src/data/catalog.json). */
export type CatalogFood = Macros & {
  key: string;
  name: string;
  category: string;
  /** Other names it should be found by; never shown. */
  also?: string;
  unit: Unit;
  units: FoodUnit[];
};

/** A food and how much of it, in the food's unit. */
export type Portion = { food: Food; quantity: number };

/**
 * A "comida": a saved group of foods with their quantities — a recipe, or a
 * usual breakfast. Not a time of day.
 */
export type Meal = {
  id: number;
  name: string;
  items: Portion[];
};

export type Entry = Portion & {
  id: number;
  /** When it was eaten, ISO-8601 UTC. */
  eatenAt: string;
  /** Set on the entries that were logged together as a meal. */
  group: { id: string; name: string } | null;
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

/** What a list of foods with quantities adds up to. */
export function totalOf(portions: { food: Macros; quantity: number }[]): Macros {
  return sumMacros(portions.map((p) => macrosFor(p.food, p.quantity)));
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

/**
 * Cleans a list of units from anywhere (the database's JSON, a form): known
 * kinds with a positive quantity, one per kind, in the order of UNIT_KINDS.
 */
export function cleanUnits(value: unknown): FoodUnit[] {
  let list = value;
  if (typeof value === "string") {
    try {
      list = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(list)) return [];
  return UNIT_KIND_LIST.flatMap((kind) => {
    const found = list.find((u) => u?.kind === kind);
    const quantity = Number(found?.quantity);
    return found && Number.isFinite(quantity) && quantity > 0 && quantity <= 100000
      ? [{ kind, quantity }]
      : [];
  });
}

/**
 * The unit a quantity is a whole or half number of, if any: 56 g of a ham
 * with 28 g slices is 2 slices.
 */
export function asUnits(
  units: FoodUnit[],
  quantity: number,
): { unit: FoodUnit; count: number } | null {
  for (const unit of units) {
    const halves = (quantity / unit.quantity) * 2;
    if (halves >= 1 && Math.abs(halves - Math.round(halves)) < 1e-6) {
      return { unit, count: Math.round(halves) / 2 };
    }
  }
  return null;
}

/** A food's units as the text fields of a form: how much one of each is, empty for the ones it doesn't have. */
export function unitFields(units: FoodUnit[]): Record<UnitKind, string> {
  const fields = {} as Record<UnitKind, string>;
  for (const kind of UNIT_KIND_LIST) {
    const quantity = units.find((u) => u.kind === kind)?.quantity;
    fields[kind] = quantity === undefined ? "" : String(quantity).replace(".", ",");
  }
  return fields;
}

/** "½ feta", "1 feta", "2 fetas". */
export function formatCount(kind: UnitKind, count: number): string {
  const names = UNIT_KINDS[kind];
  if (count === 0.5) return `½ ${names.one}`;
  return `${formatAmount(count)} ${count === 1 ? names.one : names.many}`;
}

/** A quantity of a food: "80 g", or "2 fetas · 56 g" when it's a round number of one of its units. */
export function formatQuantity(food: Pick<Food, "unit" | "units">, quantity: number): string {
  const amount = `${formatAmount(quantity)} ${food.unit}`;
  const counted = asUnits(food.units, quantity);
  return counted ? `${formatCount(counted.unit.kind, counted.count)} · ${amount}` : amount;
}

/** How much of a food to start a form with when nothing says otherwise: one piece or serving, or 100. */
export function usualQuantity(food: Pick<Food, "units">): number {
  const unit = food.units.find((u) => u.kind === "unit" || u.kind === "serving");
  return unit?.quantity ?? 100;
}

/** "1 alimento", "3 alimentos". */
export function countFoods(n: number): string {
  return `${n} ${n === 1 ? "alimento" : "alimentos"}`;
}
