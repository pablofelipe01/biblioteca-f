"use client";

import { useState, useTransition } from "react";
import {
  addGroup,
  removeGroup,
  setGroupMember,
} from "@/app/(profesor)/tareas/actions";
import type { AssignmentGroup, GroupMode } from "@/lib/types";
import type { StudentRow } from "./page";
import { Loader2, Plus, Trash2, Users } from "lucide-react";

/** Grupos de la tarea: el docente crea/quita grupos y asigna integrantes. */
export default function GroupManager({
  assignmentId,
  groups,
  students,
  mode,
  maxSize,
}: {
  assignmentId: string;
  groups: AssignmentGroup[];
  students: StudentRow[];
  mode: GroupMode;
  maxSize: number | null;
}) {
  const [pending, start] = useTransition();
  const [busyStudent, setBusyStudent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const membersOf = (gid: string) => students.filter((s) => s.group_id === gid);
  const unassigned = students.filter((s) => !s.group_id);

  function run(fn: () => Promise<void>, studentId: string | null = null) {
    setError(null);
    setBusyStudent(studentId);
    start(async () => {
      try {
        await fn();
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo guardar.");
      } finally {
        setBusyStudent(null);
      }
    });
  }

  return (
    <section className="bg-card rounded-2xl border p-4">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <h2 className="flex items-center gap-2 font-semibold">
          <Users className="h-4 w-4 text-brand" /> Grupos
        </h2>
        <span className="text-muted text-xs">
          {mode === "self"
            ? "Los estudiantes eligen su grupo; también puedes moverlos aquí."
            : "Asigna a cada estudiante en su grupo."}
          {maxSize ? ` Máximo ${maxSize} por grupo.` : ""}
        </span>
        <button
          type="button"
          onClick={() => run(() => addGroup(assignmentId))}
          disabled={pending}
          className="bg-card ml-auto inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium hover:border-brand disabled:opacity-50"
        >
          {pending && !busyStudent ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          Agregar grupo
        </button>
      </div>
      {error && <p className="mb-2 text-xs text-danger">{error}</p>}

      {groups.length === 0 ? (
        <p className="text-muted py-4 text-center text-sm">Aún no hay grupos.</p>
      ) : (
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((g) => {
            const members = membersOf(g.id);
            const full = maxSize != null && members.length >= maxSize;
            return (
              <div key={g.id} className="rounded-xl border bg-background p-3">
                <div className="mb-2 flex items-center gap-2">
                  <span className="bg-adventure flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white">
                    {g.number}
                  </span>
                  <span className="text-sm font-semibold">{g.name || `Grupo ${g.number}`}</span>
                  <span className={`text-xs ${full ? "text-accent" : "text-muted"}`}>
                    {members.length}
                    {maxSize ? `/${maxSize}` : ""}
                  </span>
                  <button
                    type="button"
                    onClick={() => run(() => removeGroup(assignmentId, g.id))}
                    disabled={pending}
                    title="Eliminar grupo (sus integrantes quedan sin grupo)"
                    className="text-muted ml-auto hover:text-danger disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                {members.length === 0 ? (
                  <p className="text-muted text-xs italic">Sin integrantes</p>
                ) : (
                  <ul className="space-y-0.5 text-sm">
                    {members.map((m) => (
                      <li key={m.id}>{m.full_name ?? "Estudiante"}</li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}

      {students.length > 0 && groups.length > 0 && (
        <details className="mt-4" open={unassigned.length > 0}>
          <summary className="cursor-pointer text-sm font-medium">
            Asignar integrantes{" "}
            <span className="text-muted text-xs">
              ({unassigned.length} sin grupo de {students.length})
            </span>
          </summary>
          <ul className="mt-2 divide-y rounded-xl border bg-background">
            {students.map((s) => (
              <li key={s.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                <span className="flex-1">{s.full_name ?? "Estudiante"}</span>
                {busyStudent === s.id && <Loader2 className="text-muted h-3.5 w-3.5 animate-spin" />}
                <select
                  value={s.group_id ?? ""}
                  disabled={pending}
                  onChange={(e) =>
                    run(() => setGroupMember(assignmentId, s.id, e.target.value || null), s.id)
                  }
                  className="rounded-lg border bg-card px-2 py-1 text-sm disabled:opacity-60"
                >
                  <option value="">Sin grupo</option>
                  {groups.map((g) => {
                    const count = membersOf(g.id).length;
                    const full = maxSize != null && count >= maxSize && s.group_id !== g.id;
                    return (
                      <option key={g.id} value={g.id} disabled={full}>
                        {g.name || `Grupo ${g.number}`} ({count}
                        {maxSize ? `/${maxSize}` : ""})
                      </option>
                    );
                  })}
                </select>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
