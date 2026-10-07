@AGENTS.md

# Nutri App

Personal food diary: what was eaten each day, with calories and macros. Entries are a plain timestamped list — **no** time-of-day categories (desayuno, almuerzo…): the user asked to remove them. Foods come from three places — packaged products in Open Food Facts (by barcode or name), a built-in catalog of generic foods, or typed in by hand — and whatever gets used is kept in the app's own food database. Single user, installable PWA (Android).

Vocabulary: an *alimento* is a `food`; a *comida* is a `meal` — a saved group of foods with quantities (a recipe, a usual breakfast), never a time of day.

## Conventions

- All code, comments and commits in English. UI text in rioplatense Spanish (voseo).
- No ORM: `@libsql/client` with raw SQL. Schema changes are new numbered files in `db/migrations/` (never edit an applied one), applied with `npm run db:migrate`. `.env.local` points at a local file database, so that only migrates the dev copy: run `npm run db:migrate:prod` (needs the `turso` CLI logged in) before pushing code that needs a new migration.
- Pages are Server Components reading through `src/lib/data.ts`; mutations are Server Actions in `src/app/actions.ts`. Every data function, action and page that fetches calls `requireSession()` — the proxy (`src/proxy.ts`) only redirects.
- `foods` holds nutrition **per 100 g** (or per 100 ml when `unit` is `ml`). `entries` holds only a quantity: nutrition is computed from the food (`macrosFor` in `src/lib/foods.ts`), so editing a food also changes the days it was logged on.
- A food can be counted instead of weighed: `foods.units` is a JSON list of `{kind, quantity}` — how much one *unidad*, *feta*, *rebanada*, *porción* or *envase* (the whole package) is, in g/ml. The kinds, their names and their order are `UNIT_KINDS` in `src/lib/foods.ts`; adding a kind is one line there, no migration. Entries still store only g/ml: the count is worked out again when shown (`formatQuantity`). A never-logged food starts at one unit or serving, never at a whole package. Every place a quantity is typed must offer the food's units: the big form when logging (`QuantityForm` in `AddEntry.tsx`) and `QuantityField` everywhere else (meal form, diary editors), with `draftOf` / `quantityOf` converting to and from g/ml.
- Timestamps are ISO-8601 UTC strings. `entries.eaten_at` is when it was eaten (defaults to the moment of logging, editable); the diary day an entry belongs to is the calendar day of `eaten_at` in `APP_TIME_ZONE` (`src/lib/time.ts`), never UTC.
- Logging a meal copies its foods into `entries` (scaled by the portions), sharing a `group_id` and the meal's name at that moment in `group_name`. The diary shows a group as one line. Editing or deleting a meal never touches what was already logged.
- `src/components/FoodPicker.tsx` is the one way to find a food (diary and meal form): the user's foods and the catalog filter as you type, Open Food Facts is asked by name only on request (its search is rate-limited), and a typed or scanned barcode goes through `lookupBarcode`.
- The catalog (`src/data/catalog.json`, ~330 generic foods with Argentine names) is **generated** by `scripts/catalog/build.mjs` from USDA FoodData Central SR Legacy (public domain) — never edit it or type nutrition values by hand. To add a food, add an entry with its `fdcId` to `scripts/catalog/source.json` and rebuild; its `units` point at portions of the USDA food (a slice, a medium fruit). Branded products don't belong there: they're added as the user's own foods, through Open Food Facts or by hand. Picking a catalog food copies it into `foods` (`source = 'catalog'`, `catalog_key`).
- Open Food Facts (`src/lib/off.ts`) is read-only and server-side. A product is saved as a food only when it has a name and all four values; otherwise the new-food form opens prefilled with whatever it has.
- Barcode scanning uses the browser's native `BarcodeDetector` (`src/components/BarcodeScanner.tsx`), with typing the code in the search box as the fallback. No scanning library.
- A food that's in the diary or in a meal can't be deleted.
- The meal and food forms are deliberately not `<form>` elements: on a phone the keyboard's Enter / "Go" key would submit them halfway through (it saved meals with a single food). They save only from their button; Enter just closes the keyboard.
- Number fields accept a decimal comma: parse with `parseDecimal`, display with `formatAmount` / `formatKcal`.
- Light palette defined as Tailwind theme tokens in `src/app/globals.css`.
- Local dev uses `TURSO_DATABASE_URL=file:local.db` (gitignored); the Turso credentials live only in Vercel.
- Checks: `npm run lint`, `npm run typecheck`, `npm run build`.
