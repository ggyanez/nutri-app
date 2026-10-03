"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  {
    href: "/",
    label: "Diario",
    // Adding an entry is part of the diary.
    match: (path: string) => path === "/" || path.startsWith("/agregar"),
    paths: ["M8 6h12", "M8 12h12", "M8 18h12", "M4 6h.01", "M4 12h.01", "M4 18h.01"],
  },
  {
    href: "/alimentos",
    label: "Alimentos",
    match: (path: string) => path.startsWith("/alimentos"),
    paths: ["M4 5v14", "M8 5v14", "M11 5v14", "M15 5v14", "M18 5v14", "M21 5v14"],
  },
  {
    href: "/ajustes",
    label: "Ajustes",
    match: (path: string) => path.startsWith("/ajustes"),
    paths: ["M4 21v-7", "M4 10V3", "M12 21v-9", "M12 8V3", "M20 21v-5", "M20 12V3", "M1 14h6", "M9 8h6", "M17 16h6"],
  },
];

export default function BottomNav() {
  const pathname = usePathname();
  if (pathname === "/login") return null;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-md items-stretch justify-around">
        {ITEMS.map((item) => {
          const active = item.match(pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium transition active:scale-95 ${
                active ? "text-accent" : "text-faint"
              }`}
            >
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth={active ? 2.2 : 1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                {item.paths.map((d) => (
                  <path key={d} d={d} />
                ))}
              </svg>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
