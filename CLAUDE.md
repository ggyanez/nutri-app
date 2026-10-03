@AGENTS.md

# Nutri App

Personal food diary: what was eaten each day, with calories and macros. Packaged products are found by barcode in Open Food Facts; everything scanned or typed in is kept in the app's own food database. Single user, installable PWA (Android).

## Conventions

- All code, comments and commits in English. UI text in rioplatense Spanish (voseo).
- No ORM: `@libsql/client` with raw SQL. Schema changes are new numbered files in `db/migrations/` (never edit an applied one), applied with `npm run db:migrate`. Apply migrations to prod before pushing code that needs them.
- Pages are Server Components reading through `src/lib/data.ts`; mutations are Server Actions in `src/app/actions.ts`. Every data function, action and page that fetches calls `requireSession()` — the proxy (`src/proxy.ts`) only redirects.
- `foods` holds nutrition **per 100 g** (or per 100 ml when `unit` is `ml`). `entries` holds only a quantity: nutrition is computed from the food (`macrosFor` in `src/lib/foods.ts`), so editing a food also changes the days it was logged on.
- `entries.day` is a `YYYY-MM-DD` diary day, picked by the user. "Today" and the default meal come from `APP_TIME_ZONE` in `src/lib/time.ts`, never UTC. `created_at`/`updated_at` are ISO-8601 UTC strings.
- Open Food Facts (`src/lib/off.ts`) is read-only and server-side. A product is saved as a food only when it has a name and all four values; otherwise the new-food form opens prefilled with whatever it has.
- Barcode scanning uses the browser's native `BarcodeDetector` (`src/components/BarcodeScanner.tsx`), with typing the code as the fallback. No scanning library.
- Number fields accept a decimal comma: parse with `parseDecimal`, display with `formatAmount` / `formatKcal`.
- Light palette defined as Tailwind theme tokens in `src/app/globals.css`.
- Local dev can use `TURSO_DATABASE_URL=file:local.db` (gitignored).
- Checks: `npm run lint`, `npm run typecheck`, `npm run build`.
