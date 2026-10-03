import "server-only";
import { getDb } from "./db";
import { requireSession } from "./session";
import type { Entry, Food, Meal, Unit } from "./foods";

type Row = Record<string, unknown>;

export const FOOD_COLUMNS = `
  f.id, f.barcode, f.name, f.brand, f.source, f.unit,
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

/** How many entries a food has; one with any can't be deleted. */
export async function countEntriesOfFood(id: number): Promise<number> {
  await requireSession();
  const res = await getDb().execute({
    sql: "SELECT COUNT(*) AS n FROM entries WHERE food_id = ?",
    args: [id],
  });
  return Number((res.rows[0] as Row).n);
}

/** What was eaten on a "YYYY-MM-DD" day, in the order it was logged. */
export async function getEntries(day: string): Promise<Entry[]> {
  await requireSession();
  const res = await getDb().execute({
    sql: `SELECT e.id AS entry_id, e.day, e.meal, e.quantity, ${FOOD_COLUMNS}
          FROM entries e JOIN foods f ON f.id = e.food_id
          WHERE e.day = ?
          ORDER BY e.created_at, e.id`,
    args: [day],
  });
  return res.rows.map((r) => {
    const row = r as Row;
    return {
      id: Number(row.entry_id),
      day: String(row.day),
      meal: String(row.meal) as Meal,
      quantity: Number(row.quantity),
      food: toFood(row),
    };
  });
}
