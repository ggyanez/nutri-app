# Nutri App

A minimal, mobile-first food diary: log what you eat each day and see calories and macros add up. Packaged products are found by scanning their barcode or by name, everyday foods (a banana, rice, a cut of beef) come from a built-in list, and anything else is typed in once and stays in your own food list.

## Features

- **Diario** — one day at a time: the day's calories, protein, carbs and fat, and everything eaten in chronological order. Tap an entry to change its quantity or its date and time, or delete it. A logged meal is one line that opens into its foods.
- **Agregar** — a food or a saved meal. Foods are found from one search box: your own, the built-in list of generic foods, packaged products by name, or a barcode (typed, or scanned with the camera). The quantity can be typed in grams or counted in the food's own units — slices of ham, a whole can, a banana — and starts where you left off last time; the entry is timestamped now unless you change it. A meal can be logged whole or in portions (½, 2…).
- **Comidas** — saved groups of foods with their quantities: a recipe, or what you always have for breakfast. Editing one doesn't rewrite the days it was already logged on.
- **Alimentos** — every food scanned or created, editable. Correcting a food recalculates the days it was logged on.
- **Ajustes** — log out.

## Where the nutrition data comes from

- **Packaged products** — [Open Food Facts](https://world.openfoodfacts.org), a free, collaborative product database (ODbL), by barcode or by name (products sold in Argentina first). A product found there is saved locally the first time it's used; one that's missing or incomplete opens a form prefilled with whatever is known.
- **Generic foods** — about 330 everyday foods with their Argentine names (fruit, vegetables, beef, pork and chicken cuts, fish, dairy, pasta, legumes…), with values from [USDA FoodData Central](https://fdc.nal.usda.gov) (SR Legacy, public domain). [`scripts/catalog/source.json`](./scripts/catalog/source.json) maps each name to a USDA food and [`scripts/catalog/build.mjs`](./scripts/catalog/build.mjs) generates [`src/data/catalog.json`](./src/data/catalog.json) from the dataset, so no number is typed in by hand. They're averages, and beef cuts are the closest US equivalent of the Argentine cut (*bife de chorizo* → top loin, *vacío* → flank…).
- **Everything else** — typed in from the package.

Behind a single password (a signed, long-lived cookie). Enough for one person; not a multi-user auth model.

## Stack

- [Next.js](https://nextjs.org) (App Router, Server Actions) + TypeScript + Tailwind CSS
- [Turso](https://turso.tech) (libSQL / SQLite), no ORM
- Deployed on [Vercel](https://vercel.com), installed on Android as a PWA

Camera scanning uses the browser's `BarcodeDetector`, available in Chrome on Android. Elsewhere the barcode has to be typed.

## Setup

1. Create the database and apply the migrations:
   ```bash
   turso db create nutri-app
   cp .env.local.example .env.local   # fill TURSO_DATABASE_URL / TURSO_AUTH_TOKEN
   npm install
   npm run db:migrate
   ```
   For local-only development, `TURSO_DATABASE_URL=file:local.db` works without a token.
2. Set `APP_PASSWORD` and `AUTH_SECRET` (`openssl rand -hex 32`) in `.env.local`.
3. Run it:
   ```bash
   npm run dev
   ```

## Deploy

Import the repo in Vercel and add the same environment variables (none are `NEXT_PUBLIC_`: they never reach the browser). On Android, open the URL in Chrome → **Install app**.

## Data model

See [`db/migrations`](./db/migrations):

- `foods` — name, brand, optional barcode, and nutrition per 100 g (or 100 ml). `source` says whether it came from Open Food Facts, the built-in catalog, or was typed in. `units` lists the ways it can be counted and how much each one is: a unit, a slice, a serving, the whole package.
- `meals` / `meal_items` — a named list of foods with quantities.
- `entries` — one row per thing eaten: food, quantity and when it was eaten (ISO-8601 UTC; days are grouped in Argentina time). Nutrition is computed from the food, not copied. Logging a meal adds one entry per food, tied together by `group_id`.
