import Link from "next/link";
import EntryRow from "@/components/EntryRow";
import { getEntries } from "@/lib/data";
import { formatAmount, formatKcal, macrosFor, sumMacros } from "@/lib/foods";
import { addDays, dayKey, formatDayLabel, parseDayKey } from "@/lib/time";

export default async function DiaryPage({ searchParams }: PageProps<"/">) {
  const today = dayKey(new Date());
  const day = parseDayKey((await searchParams).d) ?? today;
  const entries = await getEntries(day);
  const total = sumMacros(entries.map((e) => macrosFor(e.food, e.quantity)));

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <DayLink day={addDays(day, -1)} label="Día anterior">
          ‹
        </DayLink>
        <div className="text-center">
          <h1 className="text-2xl font-semibold first-letter:uppercase">
            {formatDayLabel(day, today)}
          </h1>
          {day !== today && (
            <Link href="/" className="text-sm text-accent underline underline-offset-4">
              Volver a hoy
            </Link>
          )}
        </div>
        <DayLink day={addDays(day, 1)} label="Día siguiente">
          ›
        </DayLink>
      </header>

      <section className="rounded-3xl border border-line bg-surface px-5 py-5">
        <p className="tabular text-4xl font-semibold">
          {formatKcal(total.kcal)} <span className="text-base font-medium text-muted">kcal</span>
        </p>
        <dl className="mt-4 grid grid-cols-3 gap-3">
          <Macro label="Proteínas" value={total.protein} dot="bg-protein" />
          <Macro label="Carbos" value={total.carbs} dot="bg-carbs" />
          <Macro label="Grasas" value={total.fat} dot="bg-fat" />
        </dl>
      </section>

      <Link
        href={day === today ? "/agregar" : `/agregar?d=${day}`}
        className="block w-full rounded-3xl bg-accent py-4 text-center text-lg font-medium text-white shadow-sm transition active:scale-[0.98]"
      >
        + Agregar
      </Link>

      {entries.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-line px-4 py-5 text-center text-sm text-muted">
          Todavía no hay nada registrado este día.
        </p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-surface">
          {entries.map((entry) => (
            <EntryRow key={`${entry.id}-${entry.quantity}-${entry.eatenAt}`} entry={entry} />
          ))}
        </ul>
      )}
    </div>
  );
}

function DayLink({
  day,
  label,
  children,
}: {
  day: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={`/?d=${day}`}
      aria-label={label}
      className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface text-2xl leading-none text-muted active:scale-95"
    >
      {children}
    </Link>
  );
}

function Macro({ label, value, dot }: { label: string; value: number; dot: string }) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-xs text-muted">
        <span className={`h-2 w-2 rounded-full ${dot}`} aria-hidden />
        {label}
      </dt>
      <dd className="tabular mt-0.5 text-lg font-semibold">{formatAmount(value)} g</dd>
    </div>
  );
}
