import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signImagePaths, toSignedList, type SignedImage } from "@/lib/images-server";
import { computeTaskResult, effectiveScore, type TaskResult } from "@/lib/grades";
import type { Assignment, AssignmentGroup, Mission } from "@/lib/types";
import AssignmentDetail from "./AssignmentDetail";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export interface SubmissionRow {
  id: string;
  mission_id: string;
  student_id: string;
  response: unknown;
  ai_feedback: string | null;
  ai_score: number | null;
  teacher_score: number | null;
  teacher_comment: string | null;
  earned_points: number;
  status: string;
  created_at: string;
  images: SignedImage[];
}

export interface StudentRow {
  id: string;
  full_name: string | null;
  grade: string | null;
  group_id: string | null;
  result: TaskResult;
  /** Entregas del estudiante indexadas por misión. */
  submissions: Record<string, SubmissionRow>;
}

export type MissionWithImages = Mission & { images: SignedImage[] };

export default async function TareaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: assignmentData } = await supabase
    .from("assignments")
    .select("*")
    .eq("id", id)
    .single();

  if (!assignmentData) notFound();
  const assignment = assignmentData as Assignment;

  const { data: missionsData } = await supabase
    .from("missions")
    .select("*")
    .eq("assignment_id", id)
    .order("mission_number", { ascending: true });

  const missions = (missionsData as Mission[] | null) ?? [];
  const missionIds = missions.map((m) => m.id);

  let rawSubs: (Omit<SubmissionRow, "images"> & {
    student: { full_name: string | null; grade: string | null } | null;
  })[] = [];
  if (missionIds.length > 0) {
    const { data: subs } = await supabase
      .from("submissions")
      .select(
        "id, mission_id, student_id, response, ai_feedback, ai_score, teacher_score, teacher_comment, earned_points, status, created_at, student:profiles(full_name, grade)",
      )
      .in("mission_id", missionIds)
      .order("created_at", { ascending: false });
    rawSubs = (subs as unknown as typeof rawSubs | null) ?? [];
  }

  // Estudiantes del curso destinatario (RLS limita a la org del docente).
  const students = new Map<string, { id: string; full_name: string | null; grade: string | null }>();
  if (assignment.grade) {
    const { data: studentRows } = await supabase
      .from("profiles")
      .select("id, full_name, grade")
      .eq("role", "alumno")
      .eq("grade", assignment.grade)
      .order("full_name", { ascending: true });
    for (const s of (studentRows as { id: string; full_name: string | null; grade: string | null }[] | null) ?? []) {
      students.set(s.id, s);
    }
  }
  // Quien respondió aunque ya no esté en el curso (p. ej. se cambió el curso de la tarea).
  for (const s of rawSubs) {
    if (!students.has(s.student_id)) {
      students.set(s.student_id, {
        id: s.student_id,
        full_name: s.student?.full_name ?? null,
        grade: s.student?.grade ?? null,
      });
    }
  }

  let groups: AssignmentGroup[] = [];
  const groupByStudent = new Map<string, string>();
  if (assignment.is_group) {
    const { data: g } = await supabase
      .from("assignment_groups")
      .select("id, assignment_id, number, name")
      .eq("assignment_id", id)
      .order("number", { ascending: true });
    groups = (g as AssignmentGroup[] | null) ?? [];
    const { data: members } = await supabase
      .from("assignment_group_members")
      .select("student_id, group_id")
      .eq("assignment_id", id);
    for (const m of (members as { student_id: string; group_id: string }[] | null) ?? []) {
      groupByStudent.set(m.student_id, m.group_id);
    }
  }

  const responseImages = (r: unknown): string[] => {
    const imgs = (r as { images?: unknown } | null)?.images;
    return Array.isArray(imgs) ? imgs.filter((p): p is string => typeof p === "string") : [];
  };

  const urls = await signImagePaths([
    ...(assignment.reference_images ?? []),
    ...missions.flatMap((m) => m.reference_images ?? []),
    ...rawSubs.flatMap((s) => responseImages(s.response)),
  ]);

  const subsByStudent = new Map<string, Record<string, SubmissionRow>>();
  for (const { student: _student, ...s } of rawSubs) {
    void _student;
    const rec = subsByStudent.get(s.student_id) ?? {};
    // Ordenadas de más reciente a más antigua: nos quedamos con la primera.
    if (!rec[s.mission_id]) {
      rec[s.mission_id] = { ...s, images: toSignedList(responseImages(s.response), urls) };
    }
    subsByStudent.set(s.student_id, rec);
  }

  const now = new Date();
  const studentRows: StudentRow[] = [...students.values()].map((s) => {
    const subs = subsByStudent.get(s.id) ?? {};
    const scores = new Map<string, number | null>();
    for (const sub of Object.values(subs)) {
      if (sub.status === "graded") scores.set(sub.mission_id, effectiveScore(sub));
    }
    return {
      ...s,
      group_id: groupByStudent.get(s.id) ?? null,
      result: computeTaskResult(missionIds, scores, { dueAt: assignment.due_at, now }),
      submissions: subs,
    };
  });

  // Cursos existentes en la institución (RLS limita a la org del profesor).
  const { data: gradeRows } = await supabase
    .from("profiles")
    .select("grade")
    .eq("role", "alumno")
    .not("grade", "is", null);
  const availableGrades = [
    ...new Set(
      (gradeRows as { grade: string | null }[] | null)
        ?.map((r) => r.grade)
        .filter((g): g is string => !!g) ?? [],
    ),
  ].sort();

  return (
    <div>
      <Link
        href="/tareas"
        className="text-muted mb-4 inline-flex items-center gap-1 text-sm hover:text-brand"
      >
        <ArrowLeft className="h-4 w-4" /> Volver a tareas
      </Link>
      <AssignmentDetail
        assignment={assignment}
        referenceImages={toSignedList(assignment.reference_images, urls)}
        missions={missions.map((m) => ({
          ...m,
          images: toSignedList(m.reference_images, urls),
        }))}
        students={studentRows}
        groups={groups}
        availableGrades={availableGrades}
      />
    </div>
  );
}
