# Nutri App

A minimal, mobile-first food diary: log what you eat each day and see calories and macros add up. Packaged products are found by scanning their barcode; anything else is typed in once and stays in your own food list.

## Features

- **Diario** — one day at a time: the day's calories, protein, carbs and fat, and everything eaten in chronological order. Tap an entry to change its quantity or its date and time, or delete it.
- **Agregar** — scan a barcode with the camera (or type it), or search your own foods. The quantity starts at the last amount you logged of that food, or its serving, and the entry is timestamped now unless you change it.
- **Alimentos** — every food scanned or created, editable. Correcting a food recalculates the days it was logged on.
- **Ajustes** — log out.

Barcodes are looked up in [Open Food Facts](https://world.openfoodfacts.org), a free, collaborative product database (ODbL). A product found there is saved locally on first scan; one that's missing or incomplete opens a form prefilled with whatever is known.

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

- `foods` — name, brand, optional barcode, and nutrition per 100 g (or 100 ml). `source` says whether it came from Open Food Facts or was typed in.
- `entries` — one row per thing eaten: food, quantity and when it was eaten (ISO-8601 UTC; days are grouped in Argentina time). Nutrition is computed from the food, not copied.
