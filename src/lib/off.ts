import "server-only";
import { cleanUnits, type FoodUnit, type Macros, type Unit, type UnitKind } from "./foods";

// Open Food Facts: free, crowd-sourced product database (ODbL). Read-only
// here. They ask every app to identify itself in the User-Agent.
const PRODUCT_API = "https://world.openfoodfacts.org/api/v2/product";
// Two ways to search by name. The classic one requires every typed word, in
// the name or the brand, which is what finding "yogur ser" needs — but it
// allows about ten requests a minute and answers with an error page when
// it's had enough. The newer one is always up but matches any of the words.
const CLASSIC_SEARCH_API = "https://world.openfoodfacts.org/cgi/search.pl";
const LOOSE_SEARCH_API = "https://search.openfoodfacts.org/search";
const USER_AGENT = "NutriApp/0.1 (https://github.com/ggyanez/nutri-app)";
const FIELDS = [
  "code",
  "countries_tags",
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
const CLASSIC_PAGE_SIZE = 60;
const LOOSE_PAGE_SIZE = 100;
const MAX_HITS = 30;

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

/**
 * A product found by name. `kcal` and the rest are null when Open Food Facts
 * doesn't have its whole nutrition table: it can still be picked, and
 * completed by hand.
 */
export type OffHit = {
  barcode: string;
  name: string;
  brand: string | null;
  /** The package size as printed: "340 g", "1 L". */
  size: string | null;
  unit: Unit;
  nutrition: Macros | null;
};

/** `exact` is false when only the loose search could be reached. */
export type OffSearch = { hits: OffHit[]; exact: boolean };

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
 * Branded products matching what was typed — a name, a brand, or both —
 * the ones sold in Argentina first. Throws if Open Food Facts can't be
 * reached at all.
 */
export async function searchOffProducts(query: string): Promise<OffSearch> {
  const words = searchWords(query);
  if (words.length === 0) return { hits: [], exact: true };

  try {
    return { hits: complete(await classicSearch(words)).slice(0, MAX_HITS), exact: true };
  } catch {
    return { hits: complete(await looseSearch(words)).slice(0, MAX_HITS), exact: false };
  }
}

/** The typed words, without accents or anything a search could read as an operator. */
function searchWords(query: string): string[] {
  return plain(query)
    .replace(/[^a-z0-9\s%]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/** Products with their nutrition table before the ones without, otherwise in the same order. */
function complete(hits: OffHit[]): OffHit[] {
  return [...hits.filter((hit) => hit.nutrition), ...hits.filter((hit) => !hit.nutrition)];
}

// One request for the whole world, and the local products are moved to the
// front here: asking it to filter by country gets the error page every time.
async function classicSearch(words: string[]): Promise<OffHit[]> {
  const params = new URLSearchParams({
    search_terms: words.join(" "),
    search_simple: "1",
    action: "process",
    json: "1",
    page_size: String(CLASSIC_PAGE_SIZE),
    sort_by: "unique_scans_n", // most scanned first
    fields: FIELDS,
  });
  const res = await get(`${CLASSIC_SEARCH_API}?${params}`);
  // When it's unavailable it answers with an HTML page, sometimes as a 200.
  if (!res.ok || !res.headers.get("content-type")?.includes("json")) {
    throw new Error(`Open Food Facts search unavailable (${res.status})`);
  }
  const body = (await res.json()) as { products?: Record<string, unknown>[] };
  return localFirst((body.products ?? []).flatMap(toHit));
}

async function looseSearch(words: string[]): Promise<OffHit[]> {
  const params = new URLSearchParams({
    q: words.join(" "),
    langs: "es,pt,en",
    page_size: String(LOOSE_PAGE_SIZE),
    fields: FIELDS,
  });
  const res = await get(`${LOOSE_SEARCH_API}?${params}`);
  if (!res.ok) throw new Error(`Open Food Facts search responded ${res.status}`);

  const body = (await res.json()) as { hits?: Record<string, unknown>[] };
  // It returns anything with one of the words; keep what has them all. Long
  // words only have to start the same, so "sardinas" finds "sardinhas" too;
  // short ones must be whole words, or "ser" would find "La Serenísima".
  const found = (body.hits ?? []).flatMap(toHit).filter(({ hit }) => {
    const have = plain(`${hit.name} ${hit.brand ?? ""}`).split(/[^a-z0-9]+/);
    return words.every((word) =>
      word.length > 5
        ? have.some((w) => w.startsWith(word.slice(0, -2)))
        : have.includes(word),
    );
  });
  return localFirst(found);
}

/** Products sold in Argentina before the rest, otherwise in the same order. */
function localFirst(found: { hit: OffHit; local: boolean }[]): OffHit[] {
  return [...found.filter((f) => f.local), ...found.filter((f) => !f.local)].map(({ hit }) => hit);
}

/** A search result as a hit, and whether it's sold in Argentina. Nothing for one without a name. */
function toHit(raw: Record<string, unknown>): { hit: OffHit; local: boolean }[] {
  const barcode = text(raw.code);
  const { name, unit, kcal, protein, carbs, fat } = toProduct(raw);
  if (!barcode || !name) return [];
  // Every brand it's filed under ("Danone, Ser"): the one typed may not be the first.
  const brand = Array.isArray(raw.brands) ? raw.brands.join(", ") : text(raw.brands);
  const whole = kcal !== null && protein !== null && carbs !== null && fat !== null;
  return [
    {
      hit: {
        barcode,
        name,
        brand,
        size: text(raw.quantity),
        unit,
        nutrition: whole ? { kcal, protein, carbs, fat } : null,
      },
      local: Array.isArray(raw.countries_tags) && raw.countries_tags.includes("en:argentina"),
    },
  ];
}

function plain(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
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
  for (const [, number, word] of plain(servingSize).matchAll(/(\d+\/\d+|\d+(?:[.,]\d+)?)\s*([a-z]+)/g)) {
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
