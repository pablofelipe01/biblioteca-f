"use client";

import { useState } from "react";
import NotaBarChart from "@/components/charts/NotaBarChart";

export interface CellResult {
  nota: number | null;
  percent: number;
  finished: boolean;
}

/** Gráfica "Notas por tarea vs estudiantes" con selector de tarea. */
export default function TaskChart({
  tasks,
  students,
}: {
  tasks: { id: string; title: string }[];
  students: { id: string; name: string; tasks: Record<string, CellResult> }[];
}) {
  const [taskId, setTaskId] = useState(tasks[tasks.length - 1]?.id ?? "");
  const current = tasks.find((t) => t.id === taskId);

  const rows = current
    ? students
        .filter((s) => s.tasks[current.id])
        .map((s) => {
          const r = s.tasks[current.id];
          return {
            id: s.id,
            label: s.name,
            nota: r.nota,
            sublabel: r.finished ? "Terminada" : `${r.percent}% avance`,
          };
        })
        .sort((a, b) => (b.nota ?? -1) - (a.nota ?? -1))
    : [];

  return (
    <div className="space-y-2">
      <label className="bg-card flex items-center gap-2 rounded-2xl border px-4 py-2.5">
        <span className="text-muted shrink-0 text-xs font-medium">Tarea</span>
        <select
          value={taskId}
          onChange={(e) => setTaskId(e.target.value)}
          disabled={tasks.length === 0}
          className="min-w-0 flex-1 truncate rounded-lg border bg-background px-2 py-1.5 text-sm outline-none focus:border-brand"
        >
          {tasks.length === 0 && <option value="">Sin tareas en el periodo</option>}
          {tasks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
      </label>
      <NotaBarChart
        title="Notas por tarea vs estudiantes"
        description={current ? current.title : undefined}
        rows={rows}
        emptyLabel="No hay tareas publicadas en este periodo."
      />
    </div>
  );
}
