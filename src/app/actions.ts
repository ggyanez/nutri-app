"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { requireSession } from "@/lib/session";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  expectedSessionToken,
  isValidPassword,
} from "@/lib/auth";
import { CATALOG } from "@/lib/catalog";
import { FOOD_COLUMNS, getMeal, toFood } from "@/lib/data";
import { cleanUnits, type Food, type FoodUnit, type Unit } from "@/lib/foods";
import { fetchOffProduct, type OffHit } from "@/lib/off";
import { searchProducts } from "@/lib/products";

export type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string };

// ---------- auth ----------

export async function login(_prev: string | null, formData: FormData): Promise<string | null> {
  const password = String(formData.get("password") ?? "");
  if (!isValidPassword(password)) {
    // Slows down guessing; there's no rate limiting beyond this.
    await new Promise((r) => setTimeout(r, 800));
    return "Contraseña incorrecta";
  }
  (await cookies()).set(SESSION_COOKIE, await expectedSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  redirect("/");
}

export async function logout(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}

// ---------- foods ----------

/** Digits only, or null if it can't be an EAN/UPC barcode. */
function cleanBarcode(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 14 ? digits : null;
}

async function findFoodByBarcode(barcode: string): Promise<Food | null> {
  const res = await getDb().execute({
    sql: `SELECT ${FOOD_COLUMNS} FROM foods f WHERE f.barcode = ?`,
    args: [barcode],
  });
  return res.rows.length ? toFood(res.rows[0]) : null;
}

/**
 * Resolves a scanned barcode to a food: one already saved, or the product
 * from Open Food Facts, which is saved on the way. `food` is null when it has
 * to be typed in by hand — Open Food Facts doesn't have it, or has it without
 * the full nutrition table.
 */
export async function lookupBarcode(
  raw: string,
): Promise<ActionResult<{ barcode: string; food: Food | null }>> {
  await requireSession();
  const barcode = cleanBarcode(raw);
  if (!barcode) return { ok: false, error: "Ese código no parece un código de barras" };

  const saved = await findFoodByBarcode(barcode);
  if (saved) return { ok: true, data: { barcode, food: saved } };

  let product;
  try {
    product = await fetchOffProduct(barcode);
  } catch {
    return { ok: false, error: "No se pudo consultar Open Food Facts" };
  }
  if (
    !product?.name ||
    product.kcal === null ||
    product.protein === null ||
    product.carbs === null ||
    product.fat === null
  ) {
    return { ok: true, data: { barcode, food: null } };
  }

  const now = new Date().toISOString();
  await getDb().execute({
    sql: `INSERT INTO foods (barcode, name, brand, source, unit, kcal, protein, carbs, fat,
                             units, created_at, updated_at)
          VALUES (?, ?, ?, 'off', ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(barcode) DO NOTHING`,
    args: [
      barcode, product.name, product.brand, product.unit,
      product.kcal, product.protein, product.carbs, product.fat,
      JSON.stringify(product.units), now, now,
    ],
  });
  revalidatePath("/", "layout");
  return { ok: true, data: { barcode, food: await findFoodByBarcode(barcode) } };
}

/** Branded products by name or brand, from Open Food Facts. Picking one goes through lookupBarcode. */
export async function findProducts(query: string): Promise<ActionResult<OffHit[]>> {
  await requireSession();
  if (query.trim().length < 3) return { ok: false, error: "Escribí al menos 3 letras" };
  try {
    return { ok: true, data: await searchProducts(query) };
  } catch {
    return { ok: false, error: "No se pudo consultar Open Food Facts" };
  }
}

/** Copies a food of the built-in catalog into the user's own foods, once, and returns it. */
export async function pickCatalogFood(key: string): Promise<ActionResult<Food>> {
  await requireSession();
  const item = CATALOG.find((food) => food.key === key);
  if (!item) return { ok: false, error: "No existe ese alimento" };

  const db = getDb();
  const now = new Date().toISOString();
  await db.execute({
    sql: `INSERT INTO foods (catalog_key, name, source, unit, kcal, protein, carbs, fat,
                             units, created_at, updated_at)
          VALUES (?, ?, 'catalog', ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(catalog_key) DO NOTHING`,
    args: [
      item.key, item.name, item.unit, item.kcal, item.protein, item.carbs, item.fat,
      JSON.stringify(cleanUnits(item.units)), now, now,
    ],
  });
  const res = await db.execute({
    sql: `SELECT ${FOOD_COLUMNS} FROM foods f WHERE f.catalog_key = ?`,
    args: [item.key],
  });
  revalidatePath("/", "layout");
  return { ok: true, data: toFood(res.rows[0]) };
}

export type FoodInput = {
  barcode: string;
  name: string;
  brand: string;
  unit: Unit;
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  units: FoodUnit[];
};

/** Creates a food, or updates the one with the given id. */
export async function saveFood(
  input: FoodInput,
  id?: number,
): Promise<ActionResult<{ id: number }>> {
  await requireSession();

  const name = input.name.trim();
  if (!name) return { ok: false, error: "Falta el nombre" };
  if (input.unit !== "g" && input.unit !== "ml") return { ok: false, error: "Unidad inválida" };

  const barcode = input.barcode.trim() === "" ? null : cleanBarcode(input.barcode);
  if (input.barcode.trim() !== "" && !barcode) {
    return { ok: false, error: "El código de barras tiene que tener entre 8 y 14 dígitos" };
  }

  const { kcal, protein, carbs, fat } = input;
  const values = { Calorías: kcal, Proteínas: protein, Carbohidratos: carbs, Grasas: fat };
  for (const [label, value] of Object.entries(values)) {
    if (value === null || !Number.isFinite(value) || value < 0) {
      return { ok: false, error: `${label}: ingresá un número` };
    }
  }
  const units = cleanUnits(input.units);
  if (units.length !== input.units.length) return { ok: false, error: "Revisá las equivalencias" };

  const db = getDb();
  const clash = barcode
    ? await db.execute({
        sql: "SELECT id FROM foods WHERE barcode = ? AND id IS NOT ?",
        args: [barcode, id ?? null],
      })
    : null;
  if (clash?.rows.length) return { ok: false, error: "Ya tenés un alimento con ese código" };

  const now = new Date().toISOString();
  const brand = input.brand.trim() || null;
  const res =
    id === undefined
      ? await db.execute({
          sql: `INSERT INTO foods (barcode, name, brand, source, unit, kcal, protein, carbs, fat,
                                   units, created_at, updated_at)
                VALUES (?, ?, ?, 'manual', ?, ?, ?, ?, ?, ?, ?, ?)
                RETURNING id`,
          args: [
            barcode, name, brand, input.unit, kcal, protein, carbs, fat,
            JSON.stringify(units), now, now,
          ],
        })
      : await db.execute({
          sql: `UPDATE foods SET barcode = ?, name = ?, brand = ?, unit = ?, kcal = ?, protein = ?,
                                 carbs = ?, fat = ?, units = ?, updated_at = ?
                WHERE id = ?
                RETURNING id`,
          args: [
            barcode, name, brand, input.unit, kcal, protein, carbs, fat,
            JSON.stringify(units), now, id,
          ],
        });
  if (res.rows.length === 0) return { ok: false, error: "No existe ese alimento" };

  revalidatePath("/", "layout");
  return { ok: true, data: { id: Number(res.rows[0].id) } };
}

/** Sets how much one of a unit is on a food (replacing that unit if it had it) and returns the food. */
export async function setFoodUnit(id: number, unit: FoodUnit): Promise<ActionResult<Food>> {
  await requireSession();
  if (cleanUnits([unit]).length !== 1) return { ok: false, error: "Ingresá cuánto es" };

  const db = getDb();
  const current = await db.execute({ sql: "SELECT units FROM foods WHERE id = ?", args: [id] });
  if (current.rows.length === 0) return { ok: false, error: "No existe ese alimento" };
  const others = cleanUnits(current.rows[0].units).filter((u) => u.kind !== unit.kind);
  await db.execute({
    sql: "UPDATE foods SET units = ?, updated_at = ? WHERE id = ?",
    args: [JSON.stringify(cleanUnits([...others, unit])), new Date().toISOString(), id],
  });
  const res = await db.execute({
    sql: `SELECT ${FOOD_COLUMNS} FROM foods f WHERE f.id = ?`,
    args: [id],
  });
  revalidatePath("/", "layout");
  return { ok: true, data: toFood(res.rows[0]) };
}

export async function deleteFood(id: number): Promise<ActionResult> {
  await requireSession();
  // Foods in use stay: deleting one would leave holes in past days or in a meal.
  const res = await getDb().execute({
    sql: `DELETE FROM foods
          WHERE id = ?
            AND NOT EXISTS (SELECT 1 FROM entries WHERE food_id = foods.id)
            AND NOT EXISTS (SELECT 1 FROM meal_items WHERE food_id = foods.id)`,
    args: [id],
  });
  if (res.rowsAffected === 0) {
    return { ok: false, error: "No se puede borrar: está en el diario o en una comida" };
  }
  revalidatePath("/", "layout");
  return { ok: true, data: null };
}

// ---------- meals ----------

export type MealInput = { name: string; items: { foodId: number; quantity: number }[] };

/** Creates a meal, or replaces the name and foods of the one with the given id. */
export async function saveMeal(input: MealInput, id?: number): Promise<ActionResult<{ id: number }>> {
  await requireSession();
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Falta el nombre" };
  if (input.items.length === 0) return { ok: false, error: "Agregá al menos un alimento" };
  if (input.items.some((item) => !isQuantity(item.quantity))) {
    return { ok: false, error: "Revisá las cantidades" };
  }

  const now = new Date().toISOString();
  const tx = await getDb().transaction("write");
  try {
    const res =
      id === undefined
        ? await tx.execute({
            sql: "INSERT INTO meals (name, created_at, updated_at) VALUES (?, ?, ?) RETURNING id",
            args: [name, now, now],
          })
        : await tx.execute({
            sql: "UPDATE meals SET name = ?, updated_at = ? WHERE id = ? RETURNING id",
            args: [name, now, id],
          });
    if (res.rows.length === 0) {
      await tx.rollback();
      return { ok: false, error: "No existe esa comida" };
    }
    const mealId = Number(res.rows[0].id);
    await tx.execute({ sql: "DELETE FROM meal_items WHERE meal_id = ?", args: [mealId] });
    for (const [position, item] of input.items.entries()) {
      await tx.execute({
        sql: "INSERT INTO meal_items (meal_id, food_id, quantity, position) VALUES (?, ?, ?, ?)",
        args: [mealId, item.foodId, item.quantity, position],
      });
    }
    await tx.commit();
    revalidatePath("/", "layout");
    return { ok: true, data: { id: mealId } };
  } catch {
    await tx.rollback();
    return { ok: false, error: "No se pudo guardar la comida" };
  }
}

/** Deletes a meal. What was logged with it stays in the diary. */
export async function deleteMeal(id: number): Promise<ActionResult> {
  await requireSession();
  await getDb().batch(
    [
      { sql: "DELETE FROM meal_items WHERE meal_id = ?", args: [id] },
      { sql: "DELETE FROM meals WHERE id = ?", args: [id] },
    ],
    "write",
  );
  revalidatePath("/", "layout");
  return { ok: true, data: null };
}

// ---------- entries ----------

type EntryInput = { quantity: number; eatenAt: string };

function isQuantity(n: number): boolean {
  return Number.isFinite(n) && n > 0 && n <= 10000;
}

function isDate(iso: string): boolean {
  return !Number.isNaN(new Date(iso).getTime());
}

function validateEntry(input: EntryInput): string | null {
  if (!isQuantity(input.quantity)) return "Cantidad inválida";
  if (!isDate(input.eatenAt)) return "Fecha inválida";
  return null;
}

export async function logEntry(
  input: EntryInput & { foodId: number },
): Promise<ActionResult<{ id: number }>> {
  await requireSession();
  const error = validateEntry(input);
  if (error) return { ok: false, error };

  const now = new Date().toISOString();
  const res = await getDb().execute({
    sql: `INSERT INTO entries (food_id, quantity, eaten_at, created_at, updated_at)
          SELECT id, ?, ?, ?, ? FROM foods WHERE id = ?
          RETURNING id`,
    args: [input.quantity, new Date(input.eatenAt).toISOString(), now, now, input.foodId],
  });
  if (res.rows.length === 0) return { ok: false, error: "No existe ese alimento" };

  revalidatePath("/", "layout");
  return { ok: true, data: { id: Number(res.rows[0].id) } };
}

export async function updateEntry(id: number, input: EntryInput): Promise<ActionResult> {
  await requireSession();
  const error = validateEntry(input);
  if (error) return { ok: false, error };

  await getDb().execute({
    sql: "UPDATE entries SET quantity = ?, eaten_at = ?, updated_at = ? WHERE id = ?",
    args: [input.quantity, new Date(input.eatenAt).toISOString(), new Date().toISOString(), id],
  });
  revalidatePath("/", "layout");
  return { ok: true, data: null };
}

export async function deleteEntry(id: number): Promise<ActionResult> {
  await requireSession();
  await getDb().execute({ sql: "DELETE FROM entries WHERE id = ?", args: [id] });
  revalidatePath("/", "layout");
  return { ok: true, data: null };
}

/**
 * Logs a meal: each of its foods becomes an entry, scaled by `portions` (0.5
 * for half of it), all at the same moment and sharing a group.
 */
export async function logMeal(input: {
  mealId: number;
  portions: number;
  eatenAt: string;
}): Promise<ActionResult> {
  await requireSession();
  if (!Number.isFinite(input.portions) || input.portions <= 0 || input.portions > 100) {
    return { ok: false, error: "Porciones inválidas" };
  }
  if (!isDate(input.eatenAt)) return { ok: false, error: "Fecha inválida" };
  const meal = await getMeal(input.mealId);
  if (!meal) return { ok: false, error: "No existe esa comida" };
  if (meal.items.length === 0) return { ok: false, error: "Esa comida no tiene alimentos" };

  const now = new Date().toISOString();
  const eatenAt = new Date(input.eatenAt).toISOString();
  const groupId = crypto.randomUUID();
  await getDb().batch(
    meal.items.map((item) => ({
      sql: `INSERT INTO entries (food_id, quantity, eaten_at, group_id, group_name,
                                 created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [
        item.food.id, Math.round(item.quantity * input.portions * 10) / 10,
        eatenAt, groupId, meal.name, now, now,
      ],
    })),
    "write",
  );
  revalidatePath("/", "layout");
  return { ok: true, data: null };
}

/**
 * Edits a logged meal: its date and time, and the quantity of each of its
 * foods. A food left without quantity (null or 0) is taken out.
 */
export async function updateGroup(
  groupId: string,
  input: { eatenAt: string; items: { id: number; quantity: number | null }[] },
): Promise<ActionResult> {
  await requireSession();
  if (!isDate(input.eatenAt)) return { ok: false, error: "Fecha inválida" };
  const kept = input.items.filter((item) => item.quantity !== null && item.quantity !== 0);
  if (kept.some((item) => !isQuantity(item.quantity as number))) {
    return { ok: false, error: "Revisá las cantidades" };
  }

  const now = new Date().toISOString();
  const eatenAt = new Date(input.eatenAt).toISOString();
  const keptIds = new Set(kept.map((item) => item.id));
  await getDb().batch(
    [
      ...input.items
        .filter((item) => !keptIds.has(item.id))
        .map((item) => ({
          sql: "DELETE FROM entries WHERE id = ? AND group_id = ?",
          args: [item.id, groupId],
        })),
      ...kept.map((item) => ({
        sql: "UPDATE entries SET quantity = ?, updated_at = ? WHERE id = ? AND group_id = ?",
        args: [item.quantity, now, item.id, groupId],
      })),
      {
        sql: "UPDATE entries SET eaten_at = ?, updated_at = ? WHERE group_id = ?",
        args: [eatenAt, now, groupId],
      },
    ],
    "write",
  );
  revalidatePath("/", "layout");
  return { ok: true, data: null };
}

export async function deleteGroup(groupId: string): Promise<ActionResult> {
  await requireSession();
  await getDb().execute({ sql: "DELETE FROM entries WHERE group_id = ?", args: [groupId] });
  revalidatePath("/", "layout");
  return { ok: true, data: null };
}
