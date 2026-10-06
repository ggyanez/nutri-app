import { logout } from "@/app/actions";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Ajustes</h1>

      <section className="rounded-3xl border border-line bg-surface px-5 py-5 text-sm text-muted">
        Los productos escaneados vienen de{" "}
        <a
          href="https://world.openfoodfacts.org"
          target="_blank"
          rel="noreferrer"
          className="text-accent underline underline-offset-4"
        >
          Open Food Facts
        </a>
        , una base abierta y colaborativa (licencia ODbL). Los alimentos genéricos de la base
        (frutas, verduras, carnes, etc.) usan valores de{" "}
        <a
          href="https://fdc.nal.usda.gov"
          target="_blank"
          rel="noreferrer"
          className="text-accent underline underline-offset-4"
        >
          USDA FoodData Central
        </a>
        , de dominio público: son promedios, y los cortes de carne son el equivalente más cercano
        al corte argentino.
      </section>

      <form action={logout}>
        <button
          type="submit"
          className="w-full rounded-2xl border border-line bg-surface py-3 font-medium text-danger"
        >
          Cerrar sesión
        </button>
      </form>
    </div>
  );
}
