"use client";

import { useState } from "react";
import NotaBarChart from "@/components/charts/NotaBarChart";
import ProgressBar from "@/components/ProgressBar";
import { averageNota, formatNota, notaTone } from "@/lib/grades";
import type { AssignmentGroup } from "@/lib/types";
import type { MissionWithImages, StudentRow } from "./page";
import SubmissionReview from "./SubmissionReview";
import { CheckCircle2, ChevronDown, ChevronUp, CircleDashed, Clock, Inbox, Star, Users } from "lucide-react";

type Filter = "todos" | "terminaron" | "progreso" | "sin_empezar";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "terminaron", label: "Terminaron" },
  { key: "progreso", label: "En progreso" },
  { key: "sin_empezar", label: "Sin empezar" },
];

function status(s: StudentRow): Exclude<Filter, "todos"> {
  if (s.result.finished) return "terminaron";
  return s.result.answered > 0 ? "progreso" : "sin_empezar";
}

export default function StudentResults({
  missions,
  students,
  isGroup,
  groups,
}: {
  missions: MissionWithImages[];
  students: StudentRow[];
  isGroup: boolean;
  groups: AssignmentGroup[];
}) {
  const [filter, setFilter] = useState<Filter>("todos");

  const counts = {
    terminaron: students.filter((s) => status(s) === "terminaron").length,
    progreso: students.filter((s) => status(s) === "progreso").length,
    sin_empezar: students.filter((s) => status(s) === "sin_empezar").length,
  };
  const average = averageNota(students.map((s) => s.result.nota));
  const visible = students.filter((s) => filter === "todos" || status(s) === filter);

  // Bloques a mostrar: por grupo en tareas grupales, uno solo en individuales.
  const blocks: { key: string; title: string | null; rows: StudentRow[] }[] = isGroup
    ? [
        ...groups.map((g) => ({
          key: g.id,
          title: g.name || `Grupo ${g.number}`,
          rows: visible.filter((s) => s.group_id === g.id),
        })),
        { key: "none", title: "Sin grupo", rows: visible.filter((s) => !s.group_id) },
      ].filter((b) => b.rows.length > 0)
    : [{ key: "all", title: null, rows: visible }];

  return (
    <section className="space-y-4">
      <h2 className="font-semibold">Resultados</h2>

      {/* Resumen */}
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="bg-card rounded-2xl border p-4 sm:col-span-2">
          <p className="text-muted flex items-center gap-1.5 text-xs font-medium">
            <CheckCircle2 className="h-4 w-4 text-success" /> Terminaron la tarea
          </p>
          <p className="mt-1 text-3xl font-bold">
            {counts.terminaron}
            <span className="text-muted text-base font-medium"> de {students.length} estudiantes</span>
          </p>
          <div className="mt-2">
            <ProgressBar value={counts.terminaron} max={students.length} showLabel={false} />
          </div>
          <button
            type="button"
            onClick={() => setFilter("terminaron")}
            className="mt-2 text-xs font-medium text-brand hover:underline"
          >
            Ver quiénes terminaron →
          </button>
        </div>
        <Tile icon={<Clock className="h-4 w-4 text-accent" />} label="En progreso" value={counts.progreso} />
        <Tile
          icon={<Star className="h-4 w-4 text-brand" />}
          label="Promedio de la tarea"
          value={formatNota(average)}
          tone={notaTone(average)}
          hint={`${counts.sin_empezar} sin empezar`}
        />
      </div>

      {students.length === 0 ? (
        <p className="text-muted flex flex-col items-center gap-2 rounded-2xl border border-dashed py-12 text-sm">
          <Inbox className="h-7 w-7" />
          No hay estudiantes en el curso de esta tarea.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  filter === f.key ? "bg-adventure text-white" : "bg-card border hover:border-brand"
                }`}
              >
                {f.label}{" "}
                <span className="opacity-75">
                  {f.key === "todos" ? students.length : counts[f.key]}
                </span>
              </button>
            ))}
          </div>

          {visible.length === 0 ? (
            <p className="text-muted rounded-2xl border border-dashed py-8 text-center text-sm">
              Nadie en esta categoría.
            </p>
          ) : (
            <div className="space-y-4">
              {blocks.map((b) => (
                <div key={b.key} className="bg-card overflow-hidden rounded-2xl border">
                  {b.title && (
                    <div className="flex items-center gap-2 border-b bg-brand/5 px-4 py-2 text-sm font-semibold">
                      <Users className="h-4 w-4 text-brand" />
                      {b.title}
                      <span className="text-muted ml-auto text-xs font-normal">
                        Promedio{" "}
                        <span className={`font-semibold ${notaTone(averageNota(b.rows.map((r) => r.result.nota)))}`}>
                          {formatNota(averageNota(b.rows.map((r) => r.result.nota)))}
                        </span>
                      </span>
                    </div>
                  )}
                  <ul className="divide-y">
                    {b.rows.map((s) => (
                      <StudentItem key={s.id} student={s} missions={missions} />
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          <div className="bg-card rounded-2xl border p-4">
            <NotaBarChart
              title="Notas de la tarea vs estudiantes"
              description="Promedio de las misiones; las no respondidas cuentan como 1.0."
              rows={[...students]
                .sort((a, b) => (b.result.nota ?? -1) - (a.result.nota ?? -1))
                .map((s) => ({
                  id: s.id,
                  label: s.full_name ?? "Estudiante",
                  nota: s.result.nota,
                  sublabel: s.result.finished ? "Terminada" : `${s.result.percent}% avance`,
                }))}
            />
          </div>
        </>
      )}
    </section>
  );
}

function Tile({
  icon,
  label,
  value,
  tone = "",
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  tone?: string;
  hint?: string;
}) {
  return (
    <div className="bg-card rounded-2xl border p-4">
      <p className="text-muted flex items-center gap-1.5 text-xs font-medium">
        {icon} {label}
      </p>
      <p className={`mt-1 text-3xl font-bold ${tone}`}>{value}</p>
      {hint && <p className="text-muted mt-1 text-xs">{hint}</p>}
    </div>
  );
}

function StudentItem({
  student,
  missions,
}: {
  student: StudentRow;
  missions: MissionWithImages[];
}) {
  const [open, setOpen] = useState(false);
  const st = status(student);
  const answered = missions.filter((m) => student.submissions[m.id]);

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-background"
      >
        {st === "terminaron" ? (
          <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
        ) : st === "progreso" ? (
          <Clock className="h-5 w-5 shrink-0 text-accent" />
        ) : (
          <CircleDashed className="text-muted h-5 w-5 shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{student.full_name ?? "Estudiante"}</p>
          <div className="mt-1 max-w-48">
            <ProgressBar value={student.result.answered} max={student.result.total} />
          </div>
        </div>
        <div className="text-right">
          <p className={`text-lg font-bold ${notaTone(student.result.nota)}`}>
            {formatNota(student.result.nota)}
          </p>
          <p className="text-muted text-[11px]">nota</p>
        </div>
        {open ? <ChevronUp className="text-muted h-4 w-4" /> : <ChevronDown className="text-muted h-4 w-4" />}
      </button>
      {open && (
        <div className="space-y-2 px-4 pb-4">
          {answered.length === 0 ? (
            <p className="text-muted text-sm italic">Aún no ha respondido ninguna misión.</p>
          ) : (
            answered.map((m) => (
              <SubmissionReview key={m.id} mission={m} submission={student.submissions[m.id]} />
            ))
          )}
        </div>
      )}
    </li>
  );
}
