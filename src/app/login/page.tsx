"use client";

import { useActionState } from "react";
import { login } from "@/app/actions";

export default function LoginPage() {
  const [error, formAction, pending] = useActionState(login, null);

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <form
        action={formAction}
        className="w-full max-w-xs rounded-3xl border border-line bg-surface p-7 shadow-sm"
      >
        <h1 className="text-2xl font-semibold">Nutri App</h1>
        <p className="mt-1 mb-6 text-sm text-muted">Ingresá la contraseña para continuar.</p>
        <input
          autoFocus
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="Contraseña"
          className="w-full rounded-2xl border border-line bg-bg px-4 py-3 text-base outline-none focus:border-accent"
        />
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="mt-4 w-full rounded-2xl bg-accent py-3 font-medium text-white transition active:scale-[0.98] disabled:opacity-60"
        >
          {pending ? "Verificando…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}
