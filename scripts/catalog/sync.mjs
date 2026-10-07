// Brings the units of the catalog to the foods that were copied from it.
// A food taken from the catalog is the user's own copy, so a unit added to
// the catalog later wouldn't reach it. This adds the kinds the food doesn't
// have and leaves the ones it does alone: those may have been edited (my
// slices of ham are thinner). Safe to re-run; part of `npm run db:migrate`.
//
//   node --env-file=.env.local scripts/catalog/sync.mjs
import { readFileSync } from "node:fs";
import { createClient } from "@libsql/client";
import { KINDS } from "./kinds.mjs";

const url = process.env.TURSO_DATABASE_URL;
if (!url) {
  console.error("Missing TURSO_DATABASE_URL");
  process.exit(1);
}

const catalog = JSON.parse(
  readFileSync(new URL("../../src/data/catalog.json", import.meta.url), "utf8"),
);
const byKey = new Map(catalog.map((food) => [food.key, food]));
const db = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });

const foods = await db.execute(
  "SELECT id, name, catalog_key, units FROM foods WHERE catalog_key IS NOT NULL",
);
let changed = 0;
for (const food of foods.rows) {
  const source = byKey.get(food.catalog_key);
  if (!source) continue;
  const own = JSON.parse(food.units);
  const missing = source.units.filter((unit) => !own.some((u) => u.kind === unit.kind));
  if (missing.length === 0) continue;

  const units = [...own, ...missing].sort((a, b) => KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind));
  await db.execute({
    sql: "UPDATE foods SET units = ?, updated_at = ? WHERE id = ?",
    args: [JSON.stringify(units), new Date().toISOString(), food.id],
  });
  console.log(`${food.name}: + ${missing.map((u) => u.kind).join(", ")}`);
  changed++;
}
console.log(`Catalog units synced: ${changed} of ${foods.rows.length} food(s) updated`);
