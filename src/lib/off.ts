import "server-only";
import { cleanUnits, type FoodUnit, type Macros, type Unit, type UnitKind } from "./foods";

// Open Food Facts: free, crowd-sourced product database (ODbL). Read-only
// here. They ask every app to identify itself in the User-Agent.
const PRODUCT_API = "https://world.openfoodfacts.org/api/v2/product";
const SEARCH_API = "https://search.openfoodfacts.org/search";
const USER_AGENT = "NutriApp/0.1 (https://github.com/ggyanez/nutri-app)";
const FIELDS = [
  "code",
  "product_name",
  "product_name_es",
  "brands",
  "quantity",
  "product_quantity",
  "product_quantity_unit",
  "nutrition_data_per",
  "serving_size",
  "serving_quantity",
  "nutriments",
].join(",");
const KJ_PER_KCAL = 4.184;
const TIMEOUT_MS = 8000;
const SEARCH_PAGE_SIZE = 40;
const MAX_HITS = 20;

/** What Open Food Facts knows about a product. Any nutrition value can be missing. */
export type OffProduct = {
  name: string | null;
  brand: string | null;
  unit: Unit;
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  /** The serving and the whole package, when the product states them. */
  units: FoodUnit[];
};

/** A product found by name: one with a name and its four values, or it isn't listed. */
export type OffHit = Macros & { barcode: string; name: string; brand: string | null; unit: Unit };

/** Returns null when the barcode isn't in Open Food Facts. Throws if it can't be reached. */
export async function fetchOffProduct(barcode: string): Promise<OffProduct | null> {
  const res = await get(`${PRODUCT_API}/${barcode}.json?fields=${FIELDS}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Open Food Facts responded ${res.status}`);

  const body = (await res.json()) as { status?: number; product?: Record<string, unknown> };
  if (body.status !== 1 || !body.product) return null;
  return toProduct(body.product);
}

/**
 * Packaged products whose name matches, the ones sold in Argentina first.
 * Throws if Open Food Facts can't be reached.
 */
export async function searchOffProducts(query: string): Promise<OffHit[]> {
  // The search box speaks Lucene: keep the typed words, drop its operators.
  const words = query.replace(/[^\p{L}\p{N}\s%.,-]/gu, " ").replace(/\s+/g, " ").trim();
  if (!words) return [];

  const hits = await searchOnce(`${words} countries_tags:"en:argentina"`);
  if (hits.length < 5) {
    const known = new Set(hits.map((hit) => hit.barcode));
    hits.push(...(await searchOnce(words)).filter((hit) => !known.has(hit.barcode)));
  }
  return hits.slice(0, MAX_HITS);
}

async function searchOnce(q: string): Promise<OffHit[]> {
  const params = new URLSearchParams({
    q,
    langs: "es",
    page_size: String(SEARCH_PAGE_SIZE),
    fields: FIELDS,
  });
  const res = await get(`${SEARCH_API}?${params}`);
  if (!res.ok) throw new Error(`Open Food Facts search responded ${res.status}`);

  const body = (await res.json()) as { hits?: Record<string, unknown>[] };
  const hits: OffHit[] = [];
  for (const raw of body.hits ?? []) {
    const barcode = text(raw.code);
    const { name, brand, unit, kcal, protein, carbs, fat } = toProduct(raw);
    if (!barcode || !name || kcal === null || protein === null || carbs === null || fat === null) {
      continue;
    }
    hits.push({ barcode, name, brand, unit, kcal, protein, carbs, fat });
  }
  return hits;
}

function get(url: string): Promise<Response> {
  return fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
}

function toProduct(p: Record<string, unknown>): OffProduct {
  const n = (p.nutriments ?? {}) as Record<string, unknown>;
  const kj = amount(n["energy-kj_100g"]) ?? amount(n["energy_100g"]);
  // A string from the product API ("Brand, Parent company"), a list from the
  // search. Either way the first one is the one on the package.
  const brands = Array.isArray(p.brands) ? p.brands[0] : text(p.brands)?.split(",")[0];
  // The search doesn't say what the values are per; there, go by the package size.
  const per = text(p.nutrition_data_per);
  const liquid = per ? per === "100ml" : /\d\s*(ml|cl|l|cc)\b/i.test(text(p.quantity) ?? "");
  const unit: Unit = liquid ? "ml" : "g";
  // Already converted to g or ml by Open Food Facts; a weight for something
  // measured in ml (or the other way around) is of no use.
  const sameUnit = (text(p.product_quantity_unit) ?? unit) === unit;
  return {
    name: text(p.product_name_es) ?? text(p.product_name),
    brand: text(brands),
    unit,
    kcal: amount(n["energy-kcal_100g"]) ?? (kj === null ? null : round1(kj / KJ_PER_KCAL)),
    protein: amount(n["proteins_100g"]),
    carbs: amount(n["carbohydrates_100g"]),
    fat: amount(n["fat_100g"]),
    units: cleanUnits([
      { kind: "serving", quantity: amount(p.serving_quantity) },
      { kind: "package", quantity: sameUnit ? amount(p.product_quantity) : null },
      countedServing(text(p.serving_size), amount(p.serving_quantity)),
    ]),
  };
}

// What labels count their serving in, in the languages they come in.
const SERVING_WORDS: [RegExp, UnitKind][] = [
  [/^(fetas?|lonjas?|slices?|fatias?)$/, "slice"],
  [/^rebanadas?$/, "breadSlice"],
  [/^rodajas?$/, "round"],
  [/^(unidad(es)?|galletitas?|galletas?|alfajor(es)?|barras?|barritas?|piezas?|bombon(es)?|units?|pieces?|biscoitos?)$/, "unit"],
  [/^(cucharadas?|cdas?|tbsp)$/, "tbsp"],
  [/^(cucharaditas?|cditas?|tsp)$/, "tsp"],
  [/^(tazas?|cups?|xicaras?)$/, "cup"],
  [/^(vasos?|copos?)$/, "glass"],
];

/**
 * The unit behind a serving stated as a count: "3 galletitas (30 g)" with a
 * serving of 30 g means one galletita is 10 g; "1/2 taza (130 g)", that a
 * cup is 260 g. Null when the serving isn't counted in anything we know.
 */
function countedServing(servingSize: string | null, grams: number | null): FoodUnit | null {
  if (!servingSize || !grams) return null;
  const plain = servingSize
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  for (const [, number, word] of plain.matchAll(/(\d+\/\d+|\d+(?:[.,]\d+)?)\s*([a-z]+)/g)) {
    const kind = SERVING_WORDS.find(([words]) => words.test(word))?.[1];
    const [top, bottom] = number.replace(",", ".").split("/").map(Number);
    const count = bottom ? top / bottom : top;
    if (kind && count > 0) return { kind, quantity: round1(grams / count) };
  }
  return null;
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
