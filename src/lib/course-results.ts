import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  averageNota,
  computeTaskResult,
  effectiveScore,
  type TaskResult,
} from "@/lib/grades";

// Resultados consolidados (estudiantes × tareas) de una institución.
// Lo usan el detalle de tarea, los reportes del docente y el ranking del alumno.
// Recibe el cliente a usar: el de sesión (docente, RLS) o el admin (alumno,
// tras validar en el servidor su org y curso).

export interface CourseTask {
  id: string;
  title: string;
  grade: string | null;
  due_at: string | null;
  created_at: string;
  is_group: boolean;
  missionIds: string[];
}

export interface CourseStudent {
  id: string;
  full_name: string | null;
  grade: string | null;
}

export interface StudentSummary {
  student: CourseStudent;
  /** assignmentId → resultado (solo tareas del curso del estudiante). */
  tasks: Record<string, TaskResult>;
  /** Promedio de las notas de tareas (1.0–5.0) o null si aún no tiene. */
  general: number | null;
  finishedCount: number;
  assignedCount: number;
}

export interface CourseResults {
  tasks: CourseTask[];
  students: StudentSummary[];
}

const PAGE = 1000;

async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

function chunk<T>(arr: T[], size = 200): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function loadCourseResults(
  supabase: SupabaseClient,
  opts: {
    orgId: string;
    grade?: string | null;
    assignmentIds?: string[];
    /** Periodo (inclusive) sobre la fecha de la tarea = entrega o, si no hay, creación. */
    from?: string | null;
    to?: string | null;
  },
): Promise<CourseResults> {
  let q = supabase
    .from("assignments")
    .select("id, title, grade, due_at, created_at, is_group, missions(id, mission_number)")
    .eq("org_id", opts.orgId)
    .eq("is_published", true)
    .not("grade", "is", null)
    .order("created_at", { ascending: true });
  if (opts.grade) q = q.eq("grade", opts.grade);
  if (opts.assignmentIds) q = q.in("id", opts.assignmentIds);
  const { data: aRows, error: aErr } = await q;
  if (aErr) throw aErr;

  const fromT = opts.from ? new Date(`${opts.from}T00:00:00`).getTime() : null;
  const toT = opts.to ? new Date(`${opts.to}T23:59:59.999`).getTime() : null;

  const tasks: CourseTask[] = ((aRows ?? []) as unknown as {
    id: string;
    title: string;
    grade: string | null;
    due_at: string | null;
    created_at: string;
    is_group: boolean | null;
    missions: { id: string; mission_number: number }[] | null;
  }[])
    .filter((a) => {
      const t = new Date(a.due_at ?? a.created_at).getTime();
      return (fromT == null || t >= fromT) && (toT == null || t <= toT);
    })
    .map((a) => ({
      id: a.id,
      title: a.title,
      grade: a.grade,
      due_at: a.due_at,
      created_at: a.created_at,
      is_group: !!a.is_group,
      missionIds: [...(a.missions ?? [])]
        .sort((x, y) => x.mission_number - y.mission_number)
        .map((m) => m.id),
    }));

  const grades = [...new Set(tasks.map((t) => t.grade).filter((g): g is string => !!g))];
  if (opts.grade && !grades.includes(opts.grade)) grades.push(opts.grade);
  if (grades.length === 0) return { tasks, students: [] };

  const studentRows = await fetchAll<CourseStudent>((from, to) =>
    supabase
      .from("profiles")
      .select("id, full_name, grade")
      .eq("org_id", opts.orgId)
      .eq("role", "alumno")
      .in("grade", grades)
      .order("full_name", { ascending: true })
      .range(from, to),
  );

  // Puntajes: studentId → missionId → puntaje efectivo.
  const scores = new Map<string, Map<string, number | null>>();
  const missionIds = tasks.flatMap((t) => t.missionIds);
  for (const ids of chunk(missionIds)) {
    const subs = await fetchAll<{
      student_id: string;
      mission_id: string;
      ai_score: number | null;
      teacher_score: number | null;
    }>((from, to) =>
      supabase
        .from("submissions")
        .select("student_id, mission_id, ai_score, teacher_score")
        .in("mission_id", ids)
        .eq("status", "graded")
        .order("id")
        .range(from, to),
    );
    for (const s of subs) {
      const m = scores.get(s.student_id) ?? new Map<string, number | null>();
      m.set(s.mission_id, effectiveScore(s));
      scores.set(s.student_id, m);
    }
  }

  const now = new Date();
  const students: StudentSummary[] = studentRows.map((student) => {
    const own = scores.get(student.id) ?? new Map<string, number | null>();
    const mine = tasks.filter((t) => t.grade === student.grade && t.missionIds.length > 0);
    const results: Record<string, TaskResult> = {};
    for (const t of mine) {
      results[t.id] = computeTaskResult(t.missionIds, own, { dueAt: t.due_at, now });
    }
    const list = Object.values(results);
    return {
      student,
      tasks: results,
      general: averageNota(list.map((r) => r.nota)),
      finishedCount: list.filter((r) => r.finished).length,
      assignedCount: list.length,
    };
  });

  return { tasks, students };
}

/** Ordena para ranking: mejor nota general primero; sin nota al final. */
export function rankStudents(students: StudentSummary[]): (StudentSummary & { position: number | null })[] {
  const sorted = [...students].sort((a, b) => {
    if (a.general == null && b.general == null) {
      return (a.student.full_name ?? "").localeCompare(b.student.full_name ?? "");
    }
    if (a.general == null) return 1;
    if (b.general == null) return -1;
    return b.general - a.general || b.finishedCount - a.finishedCount;
  });
  let lastKey = "";
  let lastPos = 0;
  return sorted.map((s, i) => {
    if (s.general == null) return { ...s, position: null };
    const key = `${s.general}|${s.finishedCount}`;
    const position = key === lastKey ? lastPos : i + 1;
    lastKey = key;
    lastPos = position;
    return { ...s, position };
  });
}
