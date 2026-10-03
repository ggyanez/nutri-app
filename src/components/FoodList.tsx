"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatAmount, formatKcal, type Food } from "@/lib/foods";
import { normalize } from "@/lib/search";

export default function FoodList({ foods }: { foods: Food[] }) {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = normalize(query);
    if (!q) return foods;
    return foods.filter((f) => normalize(`${f.name} ${f.brand ?? ""} ${f.barcode ?? ""}`).includes(q));
  }, [foods, query]);

  return (
    <div className="space-y-3">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar…"
        className="w-full rounded-2xl border border-line bg-surface px-4 py-3 text-base outline-none placeholder:text-faint focus:border-accent"
      />
      {results.length === 0 ? (
        <p className="px-1 text-sm text-faint">Ningún alimento coincide.</p>
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
    </div>
  );
}
