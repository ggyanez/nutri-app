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
import { FOOD_COLUMNS, toFood } from "@/lib/data";
import type { Food, Unit } from "@/lib/foods";
import { fetchOffProduct } from "@/lib/off";

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
                             serving_quantity, created_at, updated_at)
          VALUES (?, ?, ?, 'off', ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(barcode) DO NOTHING`,
    args: [
      barcode, product.name, product.brand, product.unit,
      product.kcal, product.protein, product.carbs, product.fat,
      product.servingQuantity, now, now,
    ],
  });
  revalidatePath("/", "layout");
  return { ok: true, data: { barcode, food: await findFoodByBarcode(barcode) } };
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
  servingQuantity: number | null;
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

  const { kcal, protein, carbs, fat, servingQuantity } = input;
  const values = { Calorías: kcal, Proteínas: protein, Carbohidratos: carbs, Grasas: fat };
  for (const [label, value] of Object.entries(values)) {
    if (value === null || !Number.isFinite(value) || value < 0) {
      return { ok: false, error: `${label}: ingresá un número` };
    }
  }
  if (servingQuantity !== null && !(Number.isFinite(servingQuantity) && servingQuantity > 0)) {
    return { ok: false, error: "Porción inválida" };
  }

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
                                   serving_quantity, created_at, updated_at)
                VALUES (?, ?, ?, 'manual', ?, ?, ?, ?, ?, ?, ?, ?)
                RETURNING id`,
          args: [barcode, name, brand, input.unit, kcal, protein, carbs, fat, servingQuantity, now, now],
        })
      : await db.execute({
          sql: `UPDATE foods SET barcode = ?, name = ?, brand = ?, unit = ?, kcal = ?, protein = ?,
                                 carbs = ?, fat = ?, serving_quantity = ?, updated_at = ?
                WHERE id = ?
                RETURNING id`,
          args: [barcode, name, brand, input.unit, kcal, protein, carbs, fat, servingQuantity, now, id],
        });
  if (res.rows.length === 0) return { ok: false, error: "No existe ese alimento" };

  revalidatePath("/", "layout");
  return { ok: true, data: { id: Number(res.rows[0].id) } };
}

export async function deleteFood(id: number): Promise<ActionResult> {
  await requireSession();
  // Foods with entries stay: deleting one would leave holes in past days.
  const res = await getDb().execute({
    sql: `DELETE FROM foods
          WHERE id = ? AND NOT EXISTS (SELECT 1 FROM entries WHERE food_id = foods.id)`,
    args: [id],
  });
  if (res.rowsAffected === 0) {
    return { ok: false, error: "No se puede borrar: tiene registros en el diario" };
  }
  revalidatePath("/", "layout");
  return { ok: true, data: null };
}

// ---------- entries ----------

type EntryInput = { quantity: number; eatenAt: string };

function validateEntry(input: EntryInput): string | null {
  if (!Number.isFinite(input.quantity) || input.quantity <= 0 || input.quantity > 10000) {
    return "Cantidad inválida";
  }
  if (Number.isNaN(new Date(input.eatenAt).getTime())) return "Fecha inválida";
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
