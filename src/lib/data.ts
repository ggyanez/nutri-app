import "server-only";
import { getDb } from "./db";
import { requireSession } from "./session";
import type { Entry, Food, Meal, Unit } from "./foods";
import { addDays, dayKey } from "./time";

type Row = Record<string, unknown>;

export const FOOD_COLUMNS = `
  f.id, f.barcode, f.name, f.brand, f.source, f.catalog_key, f.unit,
  f.kcal, f.protein, f.carbs, f.fat, f.serving_quantity,
  (SELECT e.quantity FROM entries e WHERE e.food_id = f.id
   ORDER BY e.created_at DESC LIMIT 1) AS last_quantity`;

export function toFood(r: Row): Food {
  return {
    id: Number(r.id),
    barcode: nullableString(r.barcode),
    name: String(r.name),
    brand: nullableString(r.brand),
    source: String(r.source) as Food["source"],
    catalogKey: nullableString(r.catalog_key),
    unit: String(r.unit) as Unit,
    kcal: Number(r.kcal),
    protein: Number(r.protein),
    carbs: Number(r.carbs),
    fat: Number(r.fat),
    servingQuantity: nullableNumber(r.serving_quantity),
    lastQuantity: nullableNumber(r.last_quantity),
  };
}

function nullableString(v: unknown): string | null {
  return v === null || v === undefined || v === "" ? null : String(v);
}

function nullableNumber(v: unknown): number | null {
  return v === null || v === undefined ? null : Number(v);
}

/** Every food, the most recently eaten first, then the never-eaten ones by name. */
export async function getFoods(): Promise<Food[]> {
  await requireSession();
  const res = await getDb().execute(
    `SELECT ${FOOD_COLUMNS},
            (SELECT MAX(e.created_at) FROM entries e WHERE e.food_id = f.id) AS last_used_at
     FROM foods f
     ORDER BY last_used_at DESC NULLS LAST, f.name COLLATE NOCASE`,
  );
  return res.rows.map((r) => toFood(r as Row));
}

export async function getFood(id: number): Promise<Food | null> {
  await requireSession();
  const res = await getDb().execute({
    sql: `SELECT ${FOOD_COLUMNS} FROM foods f WHERE f.id = ?`,
    args: [id],
  });
  return res.rows.length ? toFood(res.rows[0] as Row) : null;
}

/** Where a food is used; one that's used anywhere can't be deleted. */
export async function getFoodUsage(id: number): Promise<{ entries: number; meals: number }> {
  await requireSession();
  const res = await getDb().execute({
    sql: `SELECT (SELECT COUNT(*) FROM entries WHERE food_id = ?) AS entries,
                 (SELECT COUNT(DISTINCT meal_id) FROM meal_items WHERE food_id = ?) AS meals`,
    args: [id, id],
  });
  const row = res.rows[0] as Row;
  return { entries: Number(row.entries), meals: Number(row.meals) };
}

/** Every meal with its foods, by name. */
export async function getMeals(): Promise<Meal[]> {
  await requireSession();
  return loadMeals("", []);
}

export async function getMeal(id: number): Promise<Meal | null> {
  await requireSession();
  return (await loadMeals("WHERE m.id = ?", [id]))[0] ?? null;
}

async function loadMeals(where: string, args: number[]): Promise<Meal[]> {
  // One row per food of each meal; a meal without foods still gets its row.
  const res = await getDb().execute({
    sql: `SELECT m.id AS meal_id, m.name AS meal_name, i.quantity, ${FOOD_COLUMNS}
          FROM meals m
          LEFT JOIN meal_items i ON i.meal_id = m.id
          LEFT JOIN foods f ON f.id = i.food_id
          ${where}
          ORDER BY m.name COLLATE NOCASE, m.id, i.position, i.id`,
    args,
  });
  const meals = new Map<number, Meal>();
  for (const r of res.rows) {
    const row = r as Row;
    const id = Number(row.meal_id);
    let meal = meals.get(id);
    if (!meal) {
      meal = { id, name: String(row.meal_name), items: [] };
      meals.set(id, meal);
    }
    if (row.id !== null) meal.items.push({ food: toFood(row), quantity: Number(row.quantity) });
  }
  return [...meals.values()];
}

/** What was eaten on a "YYYY-MM-DD" day of the app time zone, earliest first. */
export async function getEntries(day: string): Promise<Entry[]> {
  await requireSession();
  // The day's limits in UTC depend on the time zone, so fetch a day of slack
  // on each side and let dayKey decide.
  const res = await getDb().execute({
    sql: `SELECT e.id AS entry_id, e.quantity, e.eaten_at, e.group_id, e.group_name, ${FOOD_COLUMNS}
          FROM entries e JOIN foods f ON f.id = e.food_id
          WHERE e.eaten_at >= ? AND e.eaten_at < ?
          ORDER BY e.eaten_at, e.id`,
    args: [`${addDays(day, -1)}T00:00:00.000Z`, `${addDays(day, 2)}T00:00:00.000Z`],
  });
  return res.rows
    .map((r) => {
      const row = r as Row;
      const groupId = nullableString(row.group_id);
      return {
        id: Number(row.entry_id),
        quantity: Number(row.quantity),
        eatenAt: String(row.eaten_at),
        group: groupId ? { id: groupId, name: String(row.group_name ?? "") } : null,
        food: toFood(row),
      };
    })
    .filter((entry) => dayKey(entry.eatenAt) === day);
}
