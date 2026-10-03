-- My own food database. A row is either cached from Open Food Facts the
-- first time its barcode is scanned, or typed in by hand.
CREATE TABLE foods (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  barcode          TEXT UNIQUE,            -- digits only; NULL for foods without one
  name             TEXT NOT NULL,
  brand            TEXT,
  source           TEXT NOT NULL CHECK (source IN ('off', 'manual')),
  unit             TEXT NOT NULL DEFAULT 'g' CHECK (unit IN ('g', 'ml')),
  -- Nutrition per 100 g, or per 100 ml when unit is 'ml'.
  kcal             REAL NOT NULL CHECK (kcal >= 0),
  protein          REAL NOT NULL CHECK (protein >= 0),
  carbs            REAL NOT NULL CHECK (carbs >= 0),
  fat              REAL NOT NULL CHECK (fat >= 0),
  serving_quantity REAL CHECK (serving_quantity > 0),
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);

-- One row per thing eaten. Nutrition isn't copied here: it's computed from
-- the food, so correcting a food also corrects the days it was logged on.
CREATE TABLE entries (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  food_id    INTEGER NOT NULL REFERENCES foods(id) ON DELETE RESTRICT,
  day        TEXT NOT NULL,                -- 'YYYY-MM-DD', the diary day it belongs to
  meal       TEXT NOT NULL CHECK (meal IN ('desayuno', 'almuerzo', 'merienda', 'cena')),
  quantity   REAL NOT NULL CHECK (quantity > 0),  -- in the food's unit
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_entries_day ON entries(day);
CREATE INDEX idx_entries_food ON entries(food_id, created_at);
