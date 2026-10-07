"use client";

import { useEffect, useState } from "react";
import { findProducts } from "@/app/actions";
import type { OffHit } from "@/lib/off";
import ResultList from "./ResultList";

// Long enough not to search on every letter: Open Food Facts allows few
// searches a minute.
const TYPING_PAUSE_MS = 700;
const MIN_LETTERS = 3;
// A search that hasn't answered by now is shown as failed, with a retry,
// rather than left "searching" for good.
const GIVE_UP_MS = 20_000;

type Outcome = { query: string; attempt: number; hits: OffHit[] | null };

/**
 * Branded products matching what's typed, from Open Food Facts: any product
 * in the world, by name, by brand or both. Searches on its own a moment
 * after the typing stops. Renders nothing for fewer than three letters.
 */
export default function ProductResults({
  query,
  onPick,
  disabled = false,
}: {
  query: string;
  onPick: (hit: OffHit) => void;
  disabled?: boolean;
}) {
  const typed = query.trim();
  const searchable = typed.length >= MIN_LETTERS && !/^\d+$/.test(typed);
  // The last search that came back, and what it was for. Anything else typed
  // since then is still being looked up.
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!searchable) return;
    let stale = false;
    const timer = setTimeout(async () => {
      const gaveUp = new Promise<null>((resolve) => setTimeout(() => resolve(null), GIVE_UP_MS));
      const res = await Promise.race([findProducts(typed).catch(() => null), gaveUp]);
      if (!stale) setOutcome({ query: typed, attempt, hits: res?.ok ? res.data : null });
    }, TYPING_PAUSE_MS);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [typed, searchable, attempt]);

  if (!searchable) return null;
  const current = outcome?.query === typed && outcome.attempt === attempt ? outcome : null;

  return (
    <ResultList
      title="Productos de marca · Open Food Facts"
      disabled={disabled}
      rows={(current?.hits ?? []).map((hit) => ({
        key: `off-${hit.barcode}`,
        name: hit.name,
        detail: [hit.brand, hit.size].filter(Boolean).join(" · ") || null,
        kcal: hit.nutrition?.kcal ?? null,
        unit: hit.unit,
        onPick: () => onPick(hit),
      }))}
    >
      <p className="px-1 text-sm text-muted">
        {!current ? (
          "Buscando productos de marca…"
        ) : current.hits ? (
          "Ningún producto de marca coincide. Probá con menos palabras, o escaneá el código de barras."
        ) : (
          <>
            No se pudo buscar en Open Food Facts.{" "}
            <button
              type="button"
              onClick={() => setAttempt(attempt + 1)}
              className="font-medium text-accent underline underline-offset-4"
            >
              Reintentar
            </button>
          </>
        )}
      </p>
    </ResultList>
  );
}
