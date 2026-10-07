"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { lookupBarcode, pickCatalogFood } from "@/app/actions";
import { CATALOG } from "@/lib/catalog";
import type { Food } from "@/lib/foods";
import { normalize, searchBy } from "@/lib/search";
import BarcodeScanner from "./BarcodeScanner";
import ProductResults from "./ProductResults";
import ResultList from "./ResultList";

const MAX_RESULTS = 30;
const INPUT =
  "w-full rounded-2xl border border-line bg-surface px-4 py-3 text-base outline-none placeholder:text-faint focus:border-accent";

/**
 * Finds a food and hands it over as one of the user's own. Three places to
 * look, all from one search box: the user's foods, the built-in catalog of
 * generic foods, and branded products in Open Food Facts (by name or brand
 * as you type, or by barcode — scanned or typed).
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
          }}
        >
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            enterKeyHint="search"
            placeholder="Buscar: banana, yogur Ser, o un código"
            aria-label="Buscar alimento por nombre, marca o código de barras"
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
          <ResultList
            title="Mis alimentos"
            rows={mine.map((f) => ({
              key: `food-${f.id}`,
              name: f.name,
              detail: f.brand,
              kcal: f.kcal,
              unit: f.unit,
              onPick: () => onPick(f),
            }))}
          >
            {typed === "" && (
              <p className="rounded-3xl border border-dashed border-line px-4 py-5 text-center text-sm text-muted">
                Todavía no tenés alimentos. Buscá uno por nombre o marca, o escaneá un envase.
              </p>
            )}
          </ResultList>

          <ResultList
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

          <ProductResults query={query} onPick={(hit) => lookup(hit.barcode)} disabled={pending} />
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
