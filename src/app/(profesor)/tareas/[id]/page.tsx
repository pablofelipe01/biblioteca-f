import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Assignment, Mission } from "@/lib/types";
import AssignmentDetail from "./AssignmentDetail";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export interface SubmissionRow {
  id: string;
  mission_id: string;
  response: unknown;
  ai_feedback: string | null;
  ai_score: number | null;
  teacher_score: number | null;
  earned_points: number;
  status: string;
  created_at: string;
  student: { full_name: string | null; grade: string | null } | null;
}

export default async function TareaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: assignment } = await supabase
    .from("assignments")
    .select("*")
    .eq("id", id)
    .single();

  if (!assignment) notFound();

  const { data: missionsData } = await supabase
    .from("missions")
    .select("*")
    .eq("assignment_id", id)
    .order("mission_number", { ascending: true });

  const missions = (missionsData as Mission[] | null) ?? [];
  const missionIds = missions.map((m) => m.id);

  let submissions: SubmissionRow[] = [];
  if (missionIds.length > 0) {
    const { data: subs } = await supabase
      .from("submissions")
      .select(
        "id, mission_id, response, ai_feedback, ai_score, teacher_score, earned_points, status, created_at, student:profiles(full_name, grade)",
      )
      .in("mission_id", missionIds)
      .order("created_at", { ascending: false });
    submissions = (subs as unknown as SubmissionRow[] | null) ?? [];
  }

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
        assignment={assignment as Assignment}
        missions={missions}
        submissions={submissions}
        availableGrades={availableGrades}
      />
    </div>
  );
}
