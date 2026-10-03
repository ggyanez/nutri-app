import "server-only";
import type { Unit } from "./foods";

// Open Food Facts: free, crowd-sourced product database (ODbL). Read-only
// here. They ask every app to identify itself in the User-Agent.
const API = "https://world.openfoodfacts.org/api/v2/product";
const USER_AGENT = "NutriApp/0.1 (https://github.com/ggyanez/nutri-app)";
const FIELDS = [
  "product_name",
  "product_name_es",
  "brands",
  "nutrition_data_per",
  "serving_quantity",
  "nutriments",
].join(",");
const KJ_PER_KCAL = 4.184;

/** What Open Food Facts knows about a product. Any nutrition value can be missing. */
export type OffProduct = {
  name: string | null;
  brand: string | null;
  unit: Unit;
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  servingQuantity: number | null;
};

/** Returns null when the barcode isn't in Open Food Facts. Throws if it can't be reached. */
export async function fetchOffProduct(barcode: string): Promise<OffProduct | null> {
  const res = await fetch(`${API}/${barcode}.json?fields=${FIELDS}`, {
    headers: { "User-Agent": USER_AGENT },
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Open Food Facts responded ${res.status}`);

  const body = (await res.json()) as { status?: number; product?: Record<string, unknown> };
  if (body.status !== 1 || !body.product) return null;

  const p = body.product;
  const n = (p.nutriments ?? {}) as Record<string, unknown>;
  const kj = amount(n["energy-kj_100g"]) ?? amount(n["energy_100g"]);
  return {
    name: text(p.product_name_es) ?? text(p.product_name),
    // "Brand, Parent company" — the first one is the one on the package.
    brand: text(p.brands)?.split(",")[0].trim() || null,
    unit: p.nutrition_data_per === "100ml" ? "ml" : "g",
    kcal: amount(n["energy-kcal_100g"]) ?? (kj === null ? null : round1(kj / KJ_PER_KCAL)),
    protein: amount(n["proteins_100g"]),
    carbs: amount(n["carbohydrates_100g"]),
    fat: amount(n["fat_100g"]),
    servingQuantity: amount(p.serving_quantity) || null,
  };
}

function text(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

// Numbers sometimes arrive as strings.
function amount(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? round1(n) : null;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
