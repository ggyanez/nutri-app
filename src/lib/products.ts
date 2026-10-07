import "server-only";
import { getDb } from "./db";
import { searchOffProducts, type OffHit } from "./off";
import { normalize } from "./search";
import { requireSession } from "./session";

const DAY_MS = 24 * 60 * 60 * 1000;
// How long a search is answered from the cache. Results of the loose search
// are second best, so they're retried soon.
const EXACT_TTL_MS = 7 * DAY_MS;
const LOOSE_TTL_MS = 30 * 60 * 1000;

/**
 * Branded products by name or brand, from Open Food Facts through a cache:
 * their search is rate-limited and often down, so each search is kept, and
 * a kept one is better than none when they can't be reached. Throws only
 * when there's nothing to show at all.
 */
export async function searchProducts(query: string): Promise<OffHit[]> {
  await requireSession();
  const key = normalize(query).replace(/\s+/g, " ");
  const db = getDb();

  const cached = await db.execute({
    sql: "SELECT hits, exact, fetched_at FROM product_searches WHERE query = ?",
    args: [key],
  });
  const row = cached.rows[0];
  const kept = row ? (JSON.parse(String(row.hits)) as OffHit[]) : null;
  if (row && kept) {
    const age = Date.now() - new Date(String(row.fetched_at)).getTime();
    if (age < (Number(row.exact) ? EXACT_TTL_MS : LOOSE_TTL_MS)) return kept;
  }

  let found;
  try {
    found = await searchOffProducts(key);
  } catch (error) {
    if (kept) return kept;
    throw error;
  }
  // An exact answer that's merely old still beats a fresh loose one.
  if (!found.exact && kept && Number(row.exact)) return kept;

  await db.execute({
    sql: `INSERT INTO product_searches (query, hits, exact, fetched_at) VALUES (?, ?, ?, ?)
          ON CONFLICT(query) DO UPDATE SET
            hits = excluded.hits, exact = excluded.exact, fetched_at = excluded.fetched_at`,
    args: [key, JSON.stringify(found.hits), found.exact ? 1 : 0, new Date().toISOString()],
  });
  return found.hits;
}
