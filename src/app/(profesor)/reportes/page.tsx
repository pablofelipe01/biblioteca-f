import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth";
import { loadCourseResults, rankStudents } from "@/lib/course-results";
import { averageNota, formatNota, notaTone } from "@/lib/grades";
import NotaBarChart from "@/components/charts/NotaBarChart";
import TaskChart from "./TaskChart";
import ConsolidatedTable from "./ConsolidatedTable";
import { BarChart3, Users, ClipboardList, GraduationCap, CheckCircle2 } from "lucide-react";

export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const inputClass =
  "w-full rounded-xl border bg-card px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<{ curso?: string; desde?: string; hasta?: string }>;
}) {
  const sp = await searchParams;
  const session = await getSessionProfile();
  const orgId = session?.profile?.org_id;
  const supabase = await createClient();

  if (!orgId) {
    return (
      <p className="text-muted rounded-2xl border border-dashed py-16 text-center">
        Tu perfil no está asociado a una institución.
      </p>
    );
  }

  // Cursos: los de tareas publicadas y los de estudiantes (RLS limita a la org).
  const [{ data: aGrades }, { data: pGrades }] = await Promise.all([
    supabase
      .from("assignments")
      .select("grade")
      .eq("org_id", orgId)
      .eq("is_published", true)
      .not("grade", "is", null),
    supabase
      .from("profiles")
      .select("grade")
      .eq("org_id", orgId)
      .eq("role", "alumno")
      .not("grade", "is", null),
  ]);
  const gradeOptions = [
    ...new Set(
      [...((aGrades as { grade: string | null }[] | null) ?? []), ...((pGrades as { grade: string | null }[] | null) ?? [])]
        .map((r) => r.grade)
        .filter((g): g is string => !!g),
    ),
  ].sort();

  const curso = sp.curso && gradeOptions.includes(sp.curso) ? sp.curso : (gradeOptions[0] ?? null);
  const desde = sp.desde && DATE_RE.test(sp.desde) ? sp.desde : "";
  const hasta = sp.hasta && DATE_RE.test(sp.hasta) ? sp.hasta : "";

  const results = curso
    ? await loadCourseResults(supabase, { orgId, grade: curso, from: desde || null, to: hasta || null })
    : { tasks: [], students: [] };

  const tasks = results.tasks.filter((t) => t.missionIds.length > 0);
  const ranked = rankStudents(results.students);
  const courseAvg = averageNota(results.students.map((s) => s.general));
  const assignedTotal = results.students.reduce((n, s) => n + s.assignedCount, 0);
  const finishedTotal = results.students.reduce((n, s) => n + s.finishedCount, 0);
  const finishedPct = assignedTotal > 0 ? Math.round((finishedTotal / assignedTotal) * 100) : null;

  const periodLabel =
    desde && hasta
      ? `del ${fmtDate(desde)} al ${fmtDate(hasta)}`
      : desde
        ? `desde el ${fmtDate(desde)}`
        : hasta
          ? `hasta el ${fmtDate(hasta)}`
          : "todo el periodo";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <BarChart3 className="h-6 w-6 text-brand" /> Notas
        </h1>
        <p className="text-muted text-sm">
          Consolidado de notas por estudiante y por tarea (escala 1.0 – 5.0). Las misiones sin
          responder cuentan como 1.0 dentro de la nota de la tarea.
        </p>
      </div>

      {/* Filtros */}
      <form method="get" className="bg-card grid gap-3 rounded-2xl border p-4 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
        <label className="block">
          <span className="text-muted mb-1 block text-xs font-medium">Curso</span>
          <select name="curso" defaultValue={curso ?? ""} className={inputClass}>
            {gradeOptions.length === 0 && <option value="">Sin cursos</option>}
            {gradeOptions.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-muted mb-1 block text-xs font-medium">Desde</span>
          <input type="date" name="desde" defaultValue={desde} className={inputClass} />
        </label>
        <label className="block">
          <span className="text-muted mb-1 block text-xs font-medium">Hasta</span>
          <input type="date" name="hasta" defaultValue={hasta} className={inputClass} />
        </label>
        <button
          type="submit"
          className="bg-adventure rounded-xl px-5 py-2.5 text-sm font-semibold text-white"
        >
          Aplicar
        </button>
      </form>

      {!curso ? (
        <p className="text-muted rounded-2xl border border-dashed py-16 text-center text-sm">
          Aún no hay cursos con estudiantes o tareas publicadas.
        </p>
      ) : (
        <>
          <p className="text-muted -mt-3 text-xs">
            Curso <span className="font-semibold text-foreground">{curso}</span> · {periodLabel} · la
            fecha de cada tarea es su fecha de entrega (o de creación si no tiene).
          </p>

          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi icon={<Users className="h-4 w-4" />} label="Estudiantes" value={String(results.students.length)} />
            <Kpi icon={<ClipboardList className="h-4 w-4" />} label="Tareas en el periodo" value={String(tasks.length)} />
            <Kpi
              icon={<GraduationCap className="h-4 w-4" />}
              label="Promedio del curso"
              value={formatNota(courseAvg)}
              valueClass={notaTone(courseAvg)}
            />
            <Kpi
              icon={<CheckCircle2 className="h-4 w-4" />}
              label="Tareas terminadas"
              value={finishedPct == null ? "—" : `${finishedPct}%`}
              hint={assignedTotal > 0 ? `${finishedTotal} de ${assignedTotal}` : undefined}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <NotaBarChart
              title="Consolidado general: notas vs estudiantes"
              description="Promedio de las tareas de cada estudiante, de mayor a menor."
              rows={ranked.map((s) => ({
                id: s.student.id,
                label: s.student.full_name ?? "Estudiante",
                nota: s.general,
                sublabel:
                  s.assignedCount > 0
                    ? `${s.finishedCount}/${s.assignedCount} terminadas`
                    : undefined,
              }))}
              emptyLabel="No hay estudiantes en este curso."
            />
            <TaskChart
              tasks={tasks.map((t) => ({ id: t.id, title: t.title }))}
              students={results.students.map((s) => ({
                id: s.student.id,
                name: s.student.full_name ?? "Estudiante",
                tasks: Object.fromEntries(
                  Object.entries(s.tasks).map(([id, r]) => [
                    id,
                    { nota: r.nota, percent: r.percent, finished: r.finished },
                  ]),
                ),
              }))}
            />
          </div>

          <ConsolidatedTable
            curso={curso}
            tasks={tasks.map((t) => ({ id: t.id, title: t.title, date: t.due_at ?? t.created_at }))}
            students={ranked.map((s) => ({
              id: s.student.id,
              name: s.student.full_name ?? "Estudiante",
              general: s.general,
              position: s.position,
              tasks: Object.fromEntries(
                Object.entries(s.tasks).map(([id, r]) => [
                  id,
                  { nota: r.nota, percent: r.percent, finished: r.finished },
                ]),
              ),
            }))}
          />
        </>
      )}
    </div>
  );
}

function fmtDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("es");
}

function Kpi({
  icon,
  label,
  value,
  hint,
  valueClass = "",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  valueClass?: string;
}) {
  return (
    <div className="bg-card rounded-2xl border p-4">
      <p className="text-muted flex items-center gap-1.5 text-xs font-medium">
        <span className="text-brand">{icon}</span>
        {label}
      </p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${valueClass}`}>{value}</p>
      {hint && <p className="text-muted text-xs">{hint}</p>}
    </div>
  );
}
