import { formatKcal, type Unit } from "@/lib/foods";

export type ResultRow = {
  key: string;
  name: string;
  detail: string | null;
  /** Per 100 g/ml; null when the food's nutrition isn't known yet. */
  kcal: number | null;
  unit: Unit;
  onPick: () => void;
};

/**
 * A titled list of foods to pick from. Without rows it shows `children` (a
 * note: still searching, nothing found) or, without those either, nothing.
 */
export default function ResultList({
  title,
  rows,
  disabled = false,
  children,
}: {
  title: string;
  rows: ResultRow[];
  disabled?: boolean;
  children?: React.ReactNode;
}) {
  if (rows.length === 0 && !children) return null;

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
                  {row.kcal === null
                    ? "faltan datos"
                    : `${formatKcal(row.kcal)} kcal / 100 ${row.unit}`}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        children
      )}
    </section>
  );
}
