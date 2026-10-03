// Applies pending migrations from db/migrations (in filename order) to the
// database in TURSO_DATABASE_URL, recording each one in schema_migrations.
//
//   node --env-file=.env.local db/migrate.mjs
import { readdir, readFile } from "node:fs/promises";
import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL;
if (!url) {
  console.error("Missing TURSO_DATABASE_URL");
  process.exit(1);
}

const db = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
await db.execute(
  "CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)",
);

const applied = new Set(
  (await db.execute("SELECT name FROM schema_migrations")).rows.map((row) => row.name),
);
const dir = new URL("./migrations/", import.meta.url);
const files = (await readdir(dir)).filter((file) => file.endsWith(".sql")).sort();

let count = 0;
for (const file of files) {
  if (applied.has(file)) continue;
  const sql = await readFile(new URL(file, dir), "utf8");
  // executeMultiple has no transaction of its own, so wrap it: a failed
  // migration leaves nothing half-applied and is retried next run.
  await db.executeMultiple(
    `BEGIN;\n${sql}\nINSERT INTO schema_migrations (name, applied_at) VALUES ('${file}', '${new Date().toISOString()}');\nCOMMIT;`,
  );
  console.log(`Applied ${file}`);
  count++;
}
console.log(count ? `${count} migration(s) applied to ${url}` : `Up to date: ${url}`);
