"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { lookupBarcode } from "@/app/actions";
import { formatAmount, formatKcal, type Food } from "@/lib/foods";
import { normalize } from "@/lib/search";
import ProductResults from "./ProductResults";

/** The user's foods, filtered as they type, and under them branded products to add. */
export default function FoodList({ foods }: { foods: Food[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const results = useMemo(() => {
    const q = normalize(query);
    if (!q) return foods;
    return foods.filter((f) => normalize(`${f.name} ${f.brand ?? ""} ${f.barcode ?? ""}`).includes(q));
  }, [foods, query]);

  // Saves the product as a food and opens it; one without its nutrition
  // table opens the form to complete it instead.
  function add(barcode: string) {
    setError(null);
    startTransition(async () => {
      const res = await lookupBarcode(barcode);
      if (!res.ok) setError(res.error);
      else if (res.data.food) router.push(`/alimentos/${res.data.food.id}`);
      else router.push(`/alimentos/nuevo?barcode=${res.data.barcode}`);
    });
  }

  return (
    <div className="space-y-5">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar entre los tuyos o por marca…"
        className="w-full rounded-2xl border border-line bg-surface px-4 py-3 text-base outline-none placeholder:text-faint focus:border-accent"
      />
      {results.length === 0 ? (
        query.trim() !== "" && (
          <p className="px-1 text-sm text-faint">Ninguno de tus alimentos coincide.</p>
        )
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-surface">
          {results.map((f) => (
            <li key={f.id}>
              <Link href={`/alimentos/${f.id}`} className="block px-4 py-3 active:bg-accent-soft">
                <span className="block truncate font-medium">{f.name}</span>
                <span className="tabular block truncate text-xs text-muted">
                  {f.brand && `${f.brand} · `}
                  {formatKcal(f.kcal)} kcal · P {formatAmount(f.protein)} · C {formatAmount(f.carbs)} · G{" "}
                  {formatAmount(f.fat)} / 100 {f.unit}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="px-1 text-sm text-danger">{error}</p>}
      <ProductResults query={query} onPick={(hit) => add(hit.barcode)} disabled={pending} />
    </div>
  );
}
