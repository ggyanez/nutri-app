-- Ways to count a food instead of weighing it: the whole package, a serving,
-- a unit, a slice… A JSON list of {"kind", "quantity"}, the quantity being
-- how much one of them is in the food's unit. The kinds and their names are
-- in src/lib/foods.ts.
ALTER TABLE foods ADD COLUMN units TEXT NOT NULL DEFAULT '[]';

-- The serving was the only one of these so far. On catalog foods it was the
-- weight of one piece (a banana, an egg).
UPDATE foods
SET units = json_array(json_object(
      'kind', CASE WHEN source = 'catalog' THEN 'unit' ELSE 'serving' END,
      'quantity', serving_quantity))
WHERE serving_quantity IS NOT NULL;

ALTER TABLE foods DROP COLUMN serving_quantity;
