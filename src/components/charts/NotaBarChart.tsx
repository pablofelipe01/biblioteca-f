"use client";

import { useId, useState } from "react";
import {
  NOTA_APROBATORIA,
  NOTA_MAX,
  NOTA_MIN,
  formatNota,
} from "@/lib/grades";

export interface NotaBarRow {
  id: string;
  label: string;
  nota: number | null;
  sublabel?: string;
  highlight?: boolean;
}

const TICKS = [1, 2, 3, 4, 5];

/** Posición (0–100 %) de una nota sobre el eje 1.0–5.0. */
function pos(nota: number): number {
  const clamped = Math.min(Math.max(nota, NOTA_MIN), NOTA_MAX);
  return ((clamped - NOTA_MIN) * 100) / (NOTA_MAX - NOTA_MIN);
}

/**
 * Barras horizontales de notas (1.0–5.0), una por estudiante. Una sola serie:
 * el color solo separa "por debajo de la nota aprobatoria" y siempre va
 * acompañado de la línea de referencia y del valor escrito.
 */
export default function NotaBarChart({
  rows,
  title,
  description,
  emptyLabel = "Aún no hay datos para graficar.",
}: {
  rows: NotaBarRow[];
  title?: string;
  description?: string;
  emptyLabel?: string;
}) {
  const titleId = useId();
  const [hover, setHover] = useState<string | null>(null);
  const withNota = rows.filter((r) => r.nota != null);
  const failing = withNota.filter((r) => (r.nota as number) < NOTA_APROBATORIA).length;

  return (
    <figure className="bg-card rounded-2xl border p-4" aria-labelledby={title ? titleId : undefined}>
      {(title || description) && (
        <figcaption className="mb-3">
          {title && (
            <p id={titleId} className="font-semibold">
              {title}
            </p>
          )}
          {description && <p className="text-muted text-xs">{description}</p>}
        </figcaption>
      )}

      {rows.length === 0 ? (
        <p className="text-muted rounded-xl border border-dashed py-8 text-center text-sm">
          {emptyLabel}
        </p>
      ) : (
        <>
          <div className="text-muted mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-brand-2" /> Nota ≥ {formatNota(NOTA_APROBATORIA)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-danger" /> Por debajo de {formatNota(NOTA_APROBATORIA)}
              {failing > 0 && <> ({failing})</>}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-px bg-foreground/50" /> Aprobatoria
            </span>
          </div>

          <div
            role="list"
            aria-label={title ?? "Notas por estudiante"}
            className="grid grid-cols-[minmax(6rem,38%)_1fr] items-center gap-x-3 sm:grid-cols-[minmax(8rem,14rem)_1fr]"
          >
            {/* Eje superior */}
            <span />
            <div className="text-muted relative mb-1 mr-9 h-4 text-[10px]" aria-hidden>
              {TICKS.map((t) => (
                <span
                  key={t}
                  className="absolute -translate-x-1/2 tabular-nums"
                  style={{ left: `${pos(t)}%` }}
                >
                  {t.toFixed(1)}
                </span>
              ))}
            </div>

            {rows.map((r) => {
              const active = hover === r.id;
              const fail = r.nota != null && r.nota < NOTA_APROBATORIA;
              return (
                <div
                  key={r.id}
                  role="listitem"
                  aria-label={`${r.label}: ${r.nota == null ? "sin nota" : `nota ${formatNota(r.nota)}`}`}
                  className="contents"
                  onMouseEnter={() => setHover(r.id)}
                  onMouseLeave={() => setHover((h) => (h === r.id ? null : h))}
                >
                  <div
                    className={`min-w-0 py-1 text-right text-xs leading-tight ${
                      r.highlight ? "font-bold text-brand" : ""
                    } ${active ? "text-foreground" : ""}`}
                  >
                    <p className="truncate" title={r.label}>
                      {r.label}
                    </p>
                    {r.sublabel && (
                      <p className="text-muted truncate text-[10px]">{r.sublabel}</p>
                    )}
                  </div>

                  <div
                    className={`relative h-7 rounded-md ${
                      active || r.highlight ? "bg-background" : ""
                    }`}
                  >
                    <div className="absolute inset-y-0 left-0 right-9">
                    {/* Rejilla + línea aprobatoria */}
                    {TICKS.map((t) => (
                      <span
                        key={t}
                        aria-hidden
                        className={`absolute inset-y-0 w-px ${
                          t === NOTA_APROBATORIA ? "bg-foreground/50" : "bg-border"
                        }`}
                        style={{ left: `${pos(t)}%` }}
                      />
                    ))}

                    {r.nota == null ? (
                      <span className="text-muted absolute left-1 top-1/2 -translate-y-1/2 text-[11px] italic">
                        sin nota
                      </span>
                    ) : (
                      <>
                        <span
                          aria-hidden
                          className={`absolute left-0 top-1/2 h-3.5 -translate-y-1/2 rounded-r transition-[width] ${
                            fail ? "bg-danger" : "bg-brand-2"
                          } ${active ? "opacity-100" : "opacity-85"}`}
                          style={{ width: `max(${pos(r.nota)}%, 3px)` }}
                        />
                        <span
                          className="absolute top-1/2 -translate-y-1/2 pl-1.5 text-xs font-semibold tabular-nums"
                          style={{ left: `${pos(r.nota)}%` }}
                        >
                          {formatNota(r.nota)}
                        </span>
                      </>
                    )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-muted mt-3 text-xs">
            {withNota.length} de {rows.length} con nota
          </p>
        </>
      )}
    </figure>
  );
}
