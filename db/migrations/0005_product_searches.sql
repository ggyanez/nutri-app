-- Results of searching Open Food Facts by name, kept so the same search isn't
-- asked twice: their full-text search allows only a few requests a minute and
-- is often unavailable. `exact` is 0 when the results came from the fallback
-- search, which is worth retrying sooner.
CREATE TABLE product_searches (
  query      TEXT PRIMARY KEY,   -- what was typed, lowercased and without accents
  hits       TEXT NOT NULL,      -- JSON list of products
  exact      INTEGER NOT NULL,
  fetched_at TEXT NOT NULL
);
