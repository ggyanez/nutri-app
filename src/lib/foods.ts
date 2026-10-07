// Types and nutrition math shared by server and client code.

export type Unit = "g" | "ml";

/**
 * Ways to count a food instead of weighing it, with their names in singular
 * and plural, in the order they're offered. Adding one is a line here (and
 * in scripts/catalog/build.mjs if the catalog should use it).
 */
export const UNIT_KINDS = {
  // One piece of it: a fruit, an egg, a steak, a fillet. A food can have
  // just "unit", or sizes around it.
  unitSmall: { one: "unidad chica", many: "unidades chicas" },
  unit: { one: "unidad", many: "unidades" },
  unitLarge: { one: "unidad grande", many: "unidades grandes" },
  slice: { one: "feta", many: "fetas" },
  breadSlice: { one: "rebanada", many: "rebanadas" },
  round: { one: "rodaja", many: "rodajas" },
  leaf: { one: "hoja", many: "hojas" },
  cup: { one: "taza", many: "tazas" },
  glass: { one: "vaso", many: "vasos" },
  tbsp: { one: "cucharada", many: "cucharadas" },
  tsp: { one: "cucharadita", many: "cucharaditas" },
  handful: { one: "puñado", many: "puñados" },
  serving: { one: "porción", many: "porciones" },
  // The whole package: a can, a pot, a bottle.
  package: { one: "envase", many: "envases" },
} as const;

// Which unit a form starts in, most natural first. Never the whole package:
// a default must not log a kilo by accident.
const STARTING_KINDS = [
  "unit", "breadSlice", "slice", "round", "serving", "cup", "glass", "tbsp", "tsp",
  "handful", "leaf", "unitSmall", "unitLarge",
] as const;

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
 * with 28 g slices is 2 slices. When several fit, one of something beats
 * two of something smaller.
 */
export function asUnits(
  units: FoodUnit[],
  quantity: number,
): { unit: FoodUnit; count: number } | null {
  let best: { unit: FoodUnit; count: number } | null = null;
  for (const unit of units) {
    const halves = (quantity / unit.quantity) * 2;
    if (halves < 1 || Math.abs(halves - Math.round(halves)) > 1e-6) continue;
    const count = Math.round(halves) / 2;
    const whole = Number.isInteger(count);
    if (
      !best ||
      (whole && !Number.isInteger(best.count)) ||
      (whole === Number.isInteger(best.count) && count < best.count)
    ) {
      best = { unit, count };
    }
  }
  return best;
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

/**
 * What a unit is called on a given food. A plain "unidad" next to a small or
 * a large one is the medium one.
 */
export function unitName(kind: UnitKind, units: FoodUnit[], many = false): string {
  if (kind === "unit" && units.some((u) => u.kind === "unitSmall" || u.kind === "unitLarge")) {
    return many ? "unidades medianas" : "unidad mediana";
  }
  return UNIT_KINDS[kind][many ? "many" : "one"];
}

/** "½ feta", "1 feta", "2 fetas". */
export function formatCount(kind: UnitKind, count: number, units: FoodUnit[] = []): string {
  if (count === 0.5) return `½ ${unitName(kind, units)}`;
  return `${formatAmount(count)} ${unitName(kind, units, count !== 1)}`;
}

/** A quantity of a food: "80 g", or "2 fetas · 56 g" when it's a round number of one of its units. */
export function formatQuantity(food: Pick<Food, "unit" | "units">, quantity: number): string {
  const amount = `${formatAmount(quantity)} ${food.unit}`;
  const counted = asUnits(food.units, quantity);
  return counted
    ? `${formatCount(counted.unit.kind, counted.count, food.units)} · ${amount}`
    : amount;
}

/**
 * A quantity as it's typed in a form: a number of one of the food's units,
 * or of g/ml when `kind` is null.
 */
export type QuantityDraft = { text: string; kind: UnitKind | null };

/** What a draft amounts to in the food's g or ml; null when it isn't a number. */
export function quantityOf(food: Pick<Food, "units">, draft: QuantityDraft): number | null {
  const typed = parseDecimal(draft.text);
  const size = draft.kind ? food.units.find((u) => u.kind === draft.kind)?.quantity : 1;
  if (typed === null || size === undefined) return null;
  return Math.round(typed * size * 10) / 10;
}

/** The draft to show for a stored quantity: counted in a unit when it's a round number of one. */
export function draftOf(food: Pick<Food, "units">, quantity: number): QuantityDraft {
  const counted = asUnits(food.units, quantity);
  return counted
    ? { text: formatAmount(counted.count), kind: counted.unit.kind }
    : { text: formatAmount(quantity), kind: null };
}

/**
 * Where a form starts for a food when nothing says otherwise: one of its
 * most natural unit, or 100 g/ml if it has none. Never a whole package.
 */
export function usualDraft(food: Pick<Food, "units">): QuantityDraft {
  const kind = STARTING_KINDS.find((k) => food.units.some((u) => u.kind === k));
  return kind ? { text: "1", kind } : { text: "100", kind: null };
}

/** "1 alimento", "3 alimentos". */
export function countFoods(n: number): string {
  return `${n} ${n === 1 ? "alimento" : "alimentos"}`;
}
