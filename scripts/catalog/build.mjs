// Builds src/data/catalog.json, the built-in list of generic foods, from
// source.json (the curated list: an Argentine name for each USDA food) and
// the USDA FoodData Central "SR Legacy" dataset, which is public domain.
//
//   1. Download and unzip the SR Legacy JSON from
//      https://fdc.nal.usda.gov/download-datasets
//   2. node scripts/catalog/build.mjs path/to/FoodData_Central_sr_legacy_food_json_2018-04.json
//
// Nothing here is typed in by hand: every number comes from the dataset, and
// the build fails if an entry of source.json no longer matches it.
//
// Each entry also lists its units — ways to count the food instead of
// weighing it — as portions of the USDA food:
//
//   "unit": { "usda": "grapes", "grams": 49, "count": 10 }
//
// is the dataset's portion "10 grapes = 49 g", so one is 4.9 g. `per` says
// how many of our unit that portion is when it isn't `count` ("4 oz" taken
// whole as a serving: count 4, per 1), and `from` takes the portion from a
// closer USDA food when this one has none. Foods measured in ml can use
// plain metric volumes instead: "cup": { "ml": 250 }. Every food must end up
// with at least one unit.
import { readFileSync, writeFileSync } from "node:fs";
import { KINDS } from "./kinds.mjs";

const datasetPath = process.argv[2];
if (!datasetPath) {
  console.error("Usage: node scripts/catalog/build.mjs <SR Legacy JSON file>");
  process.exit(1);
}

// USDA nutrient numbers.
const NUTRIENTS = { 208: "kcal", 203: "protein", 205: "carbs", 204: "fat" };

const source = JSON.parse(readFileSync(new URL("./source.json", import.meta.url), "utf8"));
const dataset = JSON.parse(readFileSync(datasetPath, "utf8")).SRLegacyFoods;
const byId = new Map(dataset.map((food) => [food.fdcId, food]));

const round1 = (n) => Math.round(n * 10) / 10;
const fail = (entry, message) => {
  throw new Error(`${entry.name} (fdcId ${entry.fdcId}): ${message}`);
};

// Checks that the dataset has that portion and returns how many grams one of
// our unit is.
function portionGrams(entry, food, portion) {
  const source = portion.from ? byId.get(portion.from) : food;
  if (!source) fail(entry, `fdcId ${portion.from} is not in the dataset`);
  const count = portion.count ?? 1;
  const found = source.foodPortions.some(
    (p) => p.modifier === portion.usda && p.gramWeight === portion.grams && p.amount === count,
  );
  if (!found) fail(entry, `no "${portion.usda}" portion of ${portion.grams} g`);
  return portion.grams / (portion.per ?? count);
}

const keys = new Set();
const catalog = source.map((entry) => {
  const food = byId.get(entry.fdcId);
  if (!food) fail(entry, "not in the dataset");
  if (food.description !== entry.usda) fail(entry, `is "${food.description}" in the dataset`);
  if (keys.has(entry.key)) fail(entry, "duplicate key");
  keys.add(entry.key);

  const per100g = {};
  for (const { nutrient, amount } of food.foodNutrients) {
    const name = NUTRIENTS[nutrient.number];
    if (name) per100g[name] = amount;
  }
  for (const name of Object.values(NUTRIENTS)) {
    if (typeof per100g[name] !== "number") fail(entry, `missing ${name}`);
  }

  // Liquids are logged in ml: the dataset's own weight of a cup (or fluid
  // ounce) gives the density to convert "per 100 g" into "per 100 ml".
  const density = entry.volume ? portionGrams(entry, food, entry.volume) / entry.volume.ml : 1;

  // Ways to count it instead of weighing it: a unit, a slice, a cup…
  const units = Object.entries(entry.units ?? {}).map(([kind, portion]) => {
    if (!KINDS.includes(kind)) fail(entry, `unknown unit "${kind}"`);
    if (portion.ml !== undefined) {
      if (!entry.volume) fail(entry, `"${kind}" is a volume but the food is measured in g`);
      return { kind, quantity: portion.ml };
    }
    return { kind, quantity: round1(portionGrams(entry, food, portion) / density) };
  });
  if (units.length === 0) fail(entry, "has no units");

  return {
    key: entry.key,
    name: entry.name,
    category: entry.category,
    ...(entry.also ? { also: entry.also } : {}),
    unit: entry.volume ? "ml" : "g",
    kcal: round1(per100g.kcal * density),
    protein: round1(per100g.protein * density),
    carbs: round1(per100g.carbs * density),
    fat: round1(per100g.fat * density),
    units,
    fdcId: entry.fdcId,
  };
});

const out = new URL("../../src/data/catalog.json", import.meta.url);
// One food per line keeps the diffs readable.
writeFileSync(out, `[\n${catalog.map((food) => JSON.stringify(food)).join(",\n")}\n]\n`);
console.log(`${catalog.length} foods written to src/data/catalog.json`);
