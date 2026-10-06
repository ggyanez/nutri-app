"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { lookupBarcode, pickCatalogFood, searchProducts } from "@/app/actions";
import { CATALOG } from "@/lib/catalog";
import { formatKcal, type Food, type Unit } from "@/lib/foods";
import type { OffHit } from "@/lib/off";
import { normalize, searchBy } from "@/lib/search";
import BarcodeScanner from "./BarcodeScanner";

const MAX_RESULTS = 30;
const INPUT =
  "w-full rounded-2xl border border-line bg-surface px-4 py-3 text-base outline-none placeholder:text-faint focus:border-accent";

/**
 * Finds a food and hands it over as one of the user's own. Three places to
 * look, all from one search box: the user's foods, the built-in catalog of
 * generic foods, and packaged products in Open Food Facts (by name on
 * request, or by barcode — scanned or typed).
 *
 * `newFoodHref` is where a food can be typed in by hand; pass it only where
 * leaving the page loses nothing.
 */
export default function FoodPicker({
  foods,
  onPick,
  newFoodHref,
}: {
  foods: Food[];
  onPick: (food: Food) => void;
  newFoodHref?: (barcode?: string) => string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [scanning, setScanning] = useState(false);
  // Open Food Facts results, and what was typed when they were asked for.
  const [products, setProducts] = useState<{ query: string; hits: OffHit[] } | null>(null);
  // A barcode that didn't resolve to a food: the way out is typing it in.
  const [problem, setProblem] = useState<{ message: string; barcode?: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const typed = query.trim();
  const barcode = /^\d{8,14}$/.test(typed) ? typed : null;

  const mine = useMemo(
    () =>
      searchBy(foods, query, (f) => ({ name: f.name, extra: f.brand ?? "" })).slice(0, MAX_RESULTS),
    [foods, query],
  );
  const generic = useMemo(() => {
    // Without anything typed the whole catalog would just be noise.
    if (normalize(query).length < 2) return [];
    const taken = new Set(foods.map((f) => f.catalogKey));
    return searchBy(
      CATALOG.filter((item) => !taken.has(item.key)),
      query,
      (item) => ({ name: item.name, extra: `${item.also ?? ""} ${item.category}` }),
    ).slice(0, MAX_RESULTS);
  }, [foods, query]);

  function lookup(code: string) {
    setScanning(false);
    setProblem(null);
    startTransition(async () => {
      const res = await lookupBarcode(code);
      if (!res.ok) {
        setProblem({ message: res.error, barcode: code.replace(/\D/g, "") });
      } else if (res.data.food) {
        onPick(res.data.food);
      } else if (newFoodHref) {
        // Not in Open Food Facts, or incomplete there: straight to the form.
        router.push(newFoodHref(res.data.barcode));
      } else {
        setProblem({
          message: "Ese producto no está en Open Food Facts, o le faltan datos",
          barcode: res.data.barcode,
        });
      }
    });
  }

  function pickGeneric(key: string) {
    setProblem(null);
    startTransition(async () => {
      const res = await pickCatalogFood(key);
      if (res.ok) onPick(res.data);
      else setProblem({ message: res.error });
    });
  }

  function searchPackaged() {
    setProblem(null);
    startTransition(async () => {
      const res = await searchProducts(typed);
      if (res.ok) setProducts({ query: typed, hits: res.data });
      else setProblem({ message: res.error });
    });
  }

  const nothingLocal = typed !== "" && !barcode && mine.length === 0 && generic.length === 0;

  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <button
          type="button"
          onClick={() => setScanning(true)}
          disabled={pending}
          className="w-full rounded-3xl bg-accent py-4 text-lg font-medium text-white shadow-sm transition active:scale-[0.98] disabled:opacity-60"
        >
          {pending ? "Buscando…" : "Escanear código de barras"}
        </button>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (barcode) lookup(barcode);
            else if (typed.length >= 3) searchPackaged();
          }}
        >
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            enterKeyHint="search"
            placeholder="Buscar: banana, arroz, o un código"
            aria-label="Buscar alimento por nombre o código de barras"
            className={INPUT}
          />
        </form>
        {problem && (
          <p className="text-sm text-danger">
            {problem.message}.{" "}
            {newFoodHref ? (
              <Link
                href={newFoodHref(problem.barcode)}
                className="underline underline-offset-4"
              >
                Cargarlo a mano
              </Link>
            ) : (
              problem.barcode && "Cargalo primero desde Alimentos."
            )}
          </p>
        )}
      </section>

      {barcode && (
        <button
          type="button"
          onClick={() => lookup(barcode)}
          disabled={pending}
          className="w-full rounded-2xl border border-line bg-surface py-3 font-medium text-accent disabled:opacity-40"
        >
          Buscar el código {barcode}
        </button>
      )}

      {!barcode && (
        <>
          <Results
            title="Mis alimentos"
            empty={
              typed === ""
                ? "Todavía no tenés alimentos. Buscá uno por nombre o escaneá un envase."
                : null
            }
            rows={mine.map((f) => ({
              key: `food-${f.id}`,
              name: f.name,
              detail: f.brand,
              kcal: f.kcal,
              unit: f.unit,
              onPick: () => onPick(f),
            }))}
          />

          <Results
            title="Base de alimentos"
            rows={generic.map((item) => ({
              key: `catalog-${item.key}`,
              name: item.name,
              detail: item.category,
              kcal: item.kcal,
              unit: item.unit,
              onPick: () => pickGeneric(item.key),
            }))}
            disabled={pending}
          />

          {nothingLocal && (
            <p className="px-1 text-sm text-muted">
              No hay ningún alimento con ese nombre entre los tuyos ni en la base.
            </p>
          )}

          {typed.length >= 3 && products?.query !== typed && (
            <button
              type="button"
              onClick={searchPackaged}
              disabled={pending}
              className="w-full rounded-2xl border border-line bg-surface px-4 py-3 text-sm font-medium text-accent disabled:opacity-40"
            >
              {pending ? "Buscando…" : `Buscar “${typed}” en productos envasados`}
            </button>
          )}

          {products && products.query === typed && (
            <Results
              title="Productos envasados · Open Food Facts"
              empty="Ningún producto con datos completos coincide."
              rows={products.hits.map((hit) => ({
                key: `off-${hit.barcode}`,
                name: hit.name,
                detail: hit.brand,
                kcal: hit.kcal,
                unit: hit.unit,
                onPick: () => lookup(hit.barcode),
              }))}
              disabled={pending}
            />
          )}
        </>
      )}

      {newFoodHref && (
        <p className="px-1 text-sm text-muted">
          ¿No está?{" "}
          <Link href={newFoodHref()} className="font-medium text-accent underline underline-offset-4">
            Cargá un alimento a mano
          </Link>
        </p>
      )}

      {scanning && <BarcodeScanner onDetect={lookup} onClose={() => setScanning(false)} />}
    </div>
  );
}

type ResultRow = {
  key: string;
  name: string;
  detail: string | null;
  kcal: number;
  unit: Unit;
  onPick: () => void;
};

/** A titled list of foods to pick from. Renders nothing when it's empty and has no `empty` text. */
function Results({
  title,
  rows,
  empty = null,
  disabled = false,
}: {
  title: string;
  rows: ResultRow[];
  empty?: string | null;
  disabled?: boolean;
}) {
  if (rows.length === 0 && !empty) return null;

  return (
    <section className="space-y-2">
      <h2 className="px-1 text-sm font-medium text-muted">{title}</h2>
      {rows.length > 0 ? (
        <ul className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-surface">
          {rows.map((row) => (
            <li key={row.key}>
              <button
                type="button"
                onClick={row.onPick}
                disabled={disabled}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left active:bg-accent-soft disabled:opacity-60"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{row.name}</span>
                  {row.detail && (
                    <span className="block truncate text-xs text-muted">{row.detail}</span>
                  )}
                </span>
                <span className="tabular shrink-0 text-xs text-muted">
                  {formatKcal(row.kcal)} kcal / 100 {row.unit}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        empty && (
          <p className="rounded-3xl border border-dashed border-line px-4 py-5 text-center text-sm text-muted">
            {empty}
          </p>
        )
      )}
    </section>
  );
}
