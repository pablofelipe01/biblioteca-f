"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Search, X, SlidersHorizontal } from "lucide-react";
import {
  SCHOOL_CYCLES,
  READING_EXPERIENCES,
  DIVERSITY_TAGS,
} from "@/lib/types";

export default function CatalogFilters({
  genres,
  areas,
}: {
  genres: string[];
  areas: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [q, setQ] = useState(params.get("q") ?? "");

  function update(next: Record<string, string | null>) {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v === null || v === "") sp.delete(k);
      else sp.set(k, v);
    }
    sp.delete("page"); // cualquier cambio de filtro vuelve a la página 1
    startTransition(() => {
      router.push(`${pathname}?${sp.toString()}`);
    });
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    update({ q });
  }

  const hasFilters =
    [...params.keys()].filter((k) => k !== "page").length > 0;

  const selectClass =
    "rounded-xl border bg-card px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

  return (
    <div className="space-y-3">
      <form onSubmit={submitSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="text-muted pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por título, autor o palabra clave…"
            className="bg-card w-full rounded-xl border py-2.5 pl-9 pr-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        </div>
        <button
          type="submit"
          className="bg-adventure rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-95"
        >
          Buscar
        </button>
      </form>

      <div className="text-muted flex items-center gap-2 text-xs font-medium">
        <SlidersHorizontal className="h-3.5 w-3.5" />
        Filtros
        {isPending && <span className="text-brand">actualizando…</span>}
      </div>

      <div className="flex flex-wrap gap-2">
        <select
          value={params.get("ciclo") ?? ""}
          onChange={(e) => update({ ciclo: e.target.value })}
          className={selectClass}
          aria-label="Ciclo escolar"
        >
          <option value="">Todos los ciclos</option>
          {SCHOOL_CYCLES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select
          value={params.get("experiencia") ?? ""}
          onChange={(e) => update({ experiencia: e.target.value })}
          className={selectClass}
          aria-label="Experiencia lectora"
        >
          <option value="">Toda experiencia</option>
          {READING_EXPERIENCES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select
          value={params.get("genero") ?? ""}
          onChange={(e) => update({ genero: e.target.value })}
          className={selectClass}
          aria-label="Género"
        >
          <option value="">Todos los géneros</option>
          {genres.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>

        <select
          value={params.get("area") ?? ""}
          onChange={(e) => update({ area: e.target.value })}
          className={selectClass}
          aria-label="Área fundamental"
        >
          <option value="">Todas las áreas</option>
          {areas.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted text-xs font-medium">Diversidad:</span>
        {DIVERSITY_TAGS.map((t) => {
          const active = params.get(t.key) === "1";
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => update({ [t.key]: active ? null : "1" })}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                active
                  ? "border-brand bg-brand/10 text-brand"
                  : "text-muted hover:border-brand"
              }`}
            >
              {t.label}
            </button>
          );
        })}

        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setQ("");
              startTransition(() => router.push(pathname));
            }}
            className="text-muted ml-auto inline-flex items-center gap-1 text-xs hover:text-danger"
          >
            <X className="h-3.5 w-3.5" />
            Limpiar filtros
          </button>
        )}
      </div>
    </div>
  );
}
