-- Entries stop belonging to a meal and a day: each one just has the moment
-- it was eaten, and the diary groups by the calendar day of that moment.
CREATE TABLE entries_new (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  food_id    INTEGER NOT NULL REFERENCES foods(id) ON DELETE RESTRICT,
  quantity   REAL NOT NULL CHECK (quantity > 0),  -- in the food's unit
  eaten_at   TEXT NOT NULL,                       -- ISO-8601 UTC
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Existing entries keep the moment they were logged when that falls on their
-- diary day (Argentina, UTC-3); the ones logged for another day go to noon.
INSERT INTO entries_new (id, food_id, quantity, eaten_at, created_at, updated_at)
SELECT id, food_id, quantity,
       CASE WHEN date(created_at, '-3 hours') = day THEN created_at
            ELSE day || 'T15:00:00.000Z' END,
       created_at, updated_at
FROM entries;

DROP TABLE entries;
ALTER TABLE entries_new RENAME TO entries;

CREATE INDEX idx_entries_eaten_at ON entries(eaten_at);
CREATE INDEX idx_entries_food ON entries(food_id, created_at);
