-- Foods can now also come from the built-in catalog of generic foods
-- (src/data/catalog.json). SQLite can't change a CHECK in place, so the
-- source column is replaced by one that accepts the new value.
ALTER TABLE foods ADD COLUMN source_new TEXT NOT NULL DEFAULT 'manual'
  CHECK (source_new IN ('off', 'manual', 'catalog'));
UPDATE foods SET source_new = source;
ALTER TABLE foods DROP COLUMN source;
ALTER TABLE foods RENAME COLUMN source_new TO source;

-- The catalog entry a food was copied from; NULL for every other food.
ALTER TABLE foods ADD COLUMN catalog_key TEXT;
CREATE UNIQUE INDEX idx_foods_catalog_key ON foods(catalog_key);

-- A meal ("comida") is a saved group of foods with their quantities: a
-- recipe, or a usual breakfast. Not a time of day.
CREATE TABLE meals (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE meal_items (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  meal_id  INTEGER NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
  food_id  INTEGER NOT NULL REFERENCES foods(id) ON DELETE RESTRICT,
  quantity REAL NOT NULL CHECK (quantity > 0),  -- in the food's unit
  position INTEGER NOT NULL
);

CREATE INDEX idx_meal_items_meal ON meal_items(meal_id, position);
CREATE INDEX idx_meal_items_food ON meal_items(food_id);

-- Logging a meal copies its foods into the diary as ordinary entries that
-- share a group: changing the meal later doesn't rewrite past days, and one
-- day's quantities can differ from the recipe. group_name is the meal's name
-- at that moment.
ALTER TABLE entries ADD COLUMN group_id TEXT;
ALTER TABLE entries ADD COLUMN group_name TEXT;
