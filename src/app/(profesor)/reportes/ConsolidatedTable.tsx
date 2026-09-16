"use client";

import Link from "next/link";
import { formatNota, notaTone } from "@/lib/grades";
import type { CellResult } from "./TaskChart";
import { Download } from "lucide-react";

interface TableStudent {
  id: string;
  name: string;
  general: number | null;
  position: number | null;
  tasks: Record<string, CellResult>;
}

/** Tabla estudiantes × tareas con nota general y descarga CSV. */
export default function ConsolidatedTable({
  curso,
  tasks,
  students,
}: {
  curso: string;
  tasks: { id: string; title: string; date: string }[];
  students: TableStudent[];
}) {
  function downloadCsv() {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const header = ["Puesto", "Estudiante", ...tasks.map((t) => t.title), "Nota general"];
    const lines = students.map((s) => [
      s.position?.toString() ?? "",
      s.name,
      ...tasks.map((t) => {
        const r = s.tasks[t.id];
        if (!r) return "";
        return r.nota == null ? "" : r.nota.toFixed(1).replace(".", ",");
      }),
      s.general == null ? "" : s.general.toFixed(1).replace(".", ","),
    ]);
    // Separador ";" y coma decimal: Excel en español lo abre sin asistente.
    const csv = [header, ...lines].map((row) => row.map(esc).join(";")).join("\r\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `notas-${curso}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="bg-card rounded-2xl border">
      <div className="flex flex-wrap items-center gap-2 border-b p-4">
        <div className="flex-1">
          <h2 className="font-semibold">Notas consolidadas por estudiante</h2>
          <p className="text-muted text-xs">
            ◔ = tarea sin terminar (se muestra la nota parcial y el % de avance).
          </p>
        </div>
        <button
          type="button"
          onClick={downloadCsv}
          disabled={students.length === 0}
          className="bg-card inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium hover:border-brand disabled:opacity-50"
        >
          <Download className="h-3.5 w-3.5" /> Descargar CSV
        </button>
      </div>

      {students.length === 0 ? (
        <p className="text-muted py-10 text-center text-sm">No hay estudiantes en este curso.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-muted text-left text-xs">
                <th className="bg-card sticky left-0 z-10 min-w-40 border-b px-3 py-2 font-medium">
                  Estudiante
                </th>
                {tasks.map((t) => (
                  <th key={t.id} className="border-b px-2 py-2 text-center font-medium">
                    <Link
                      href={`/tareas/${t.id}`}
                      title={t.title}
                      className="line-clamp-2 block max-w-28 hover:text-brand"
                    >
                      {t.title}
                    </Link>
                    <span className="text-[10px] font-normal">
                      {new Date(t.date).toLocaleDateString("es")}
                    </span>
                  </th>
                ))}
                <th className="border-b px-3 py-2 text-center font-semibold text-foreground">
                  General
                </th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id} className="group hover:bg-background">
                  <td className="bg-card group-hover:bg-background sticky left-0 z-10 border-b px-3 py-2">
                    <span className="text-muted mr-1.5 inline-block w-5 text-right text-xs tabular-nums">
                      {s.position ?? "–"}
                    </span>
                    {s.name}
                  </td>
                  {tasks.map((t) => {
                    const r = s.tasks[t.id];
                    return (
                      <td key={t.id} className="border-b px-2 py-2 text-center tabular-nums">
                        {!r ? (
                          <span className="text-muted">·</span>
                        ) : (
                          <span
                            title={r.finished ? "Terminada" : `${r.percent}% de avance`}
                            className={`font-semibold ${notaTone(r.nota)}`}
                          >
                            {formatNota(r.nota)}
                            {!r.finished && (
                              <span className="text-muted ml-0.5 text-[10px] font-normal">
                                ◔{r.percent}%
                              </span>
                            )}
                          </span>
                        )}
                      </td>
                    );
                  })}
                  <td className={`border-b px-3 py-2 text-center font-bold tabular-nums ${notaTone(s.general)}`}>
                    {formatNota(s.general)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
