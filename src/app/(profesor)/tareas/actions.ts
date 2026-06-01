"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth";
import type { MissionType, Profile } from "@/lib/types";

export interface MissionInput {
  mission_number: number;
  type: MissionType;
  title: string;
  points: number;
  data: Record<string, unknown>;
}

export interface NewAssignmentInput {
  resource_id: string | null;
  title: string;
  chapter_label: string | null;
  instructions: string | null;
  excerpt_text: string;
  grade: string | null;
  due_at: string | null; // ISO o null
  missions: MissionInput[];
  publish: boolean;
}

async function requireTeacher(): Promise<{
  userId: string;
  email: string | null;
  profile: Profile;
}> {
  const session = await getSessionProfile();
  if (!session?.profile || !["profesor", "admin"].includes(session.profile.role)) {
    throw new Error("No autorizado");
  }
  return { userId: session.userId, email: session.email, profile: session.profile };
}

/** Crea la asignación + sus misiones. Devuelve el id (redirige a su detalle). */
export async function createAssignmentWithMissions(input: NewAssignmentInput) {
  const { userId, profile } = await requireTeacher();
  const supabase = await createClient();

  if (!input.title?.trim()) throw new Error("El título es obligatorio.");
  if (!input.excerpt_text?.trim()) throw new Error("El fragmento es obligatorio.");

  const { data: assignment, error } = await supabase
    .from("assignments")
    .insert({
      org_id: profile.org_id,
      teacher_id: userId,
      resource_id: input.resource_id,
      title: input.title.trim(),
      chapter_label: input.chapter_label,
      instructions: input.instructions,
      excerpt_text: input.excerpt_text,
      grade: input.grade,
      due_at: input.due_at,
      is_published: input.publish,
    })
    .select("id")
    .single();

  if (error || !assignment) {
    throw new Error(error?.message ?? "No se pudo crear la tarea.");
  }

  if (input.missions.length > 0) {
    const rows = input.missions.map((m, i) => ({
      assignment_id: assignment.id,
      mission_number: m.mission_number ?? i + 1,
      type: m.type,
      title: m.title,
      points: m.points,
      data: m.data,
    }));
    const { error: mErr } = await supabase.from("missions").insert(rows);
    if (mErr) throw new Error(mErr.message);
  }

  revalidatePath("/tareas");
  redirect(`/tareas/${assignment.id}`);
}

/** Publica o despublica una tarea. */
export async function setPublish(assignmentId: string, publish: boolean) {
  await requireTeacher();
  const supabase = await createClient();
  const { error } = await supabase
    .from("assignments")
    .update({ is_published: publish })
    .eq("id", assignmentId);
  if (error) throw new Error(error.message);
  revalidatePath(`/tareas/${assignmentId}`);
  revalidatePath("/tareas");
}

/** Actualiza el curso destinatario (grade) de una tarea. */
export async function updateAssignmentGrade(assignmentId: string, grade: string) {
  await requireTeacher();
  const supabase = await createClient();
  const { error } = await supabase
    .from("assignments")
    .update({ grade: grade.trim() || null })
    .eq("id", assignmentId);
  if (error) throw new Error(error.message);
  revalidatePath(`/tareas/${assignmentId}`);
  revalidatePath("/tareas");
}

/** Actualiza campos editables de una misión existente. */
export async function updateMission(
  missionId: string,
  fields: { title?: string; points?: number; data?: Record<string, unknown> },
) {
  await requireTeacher();
  const supabase = await createClient();
  const { data: mission } = await supabase
    .from("missions")
    .select("assignment_id")
    .eq("id", missionId)
    .single();
  const { error } = await supabase
    .from("missions")
    .update(fields)
    .eq("id", missionId);
  if (error) throw new Error(error.message);
  if (mission) revalidatePath(`/tareas/${mission.assignment_id}`);
}

/** Ajuste manual de la calificación de una entrega por el profesor. */
export async function adjustScore(submissionId: string, teacherScore: number) {
  await requireTeacher();
  const supabase = await createClient();
  const { error } = await supabase
    .from("submissions")
    .update({ teacher_score: teacherScore, status: "graded" })
    .eq("id", submissionId);
  if (error) throw new Error(error.message);
  revalidatePath("/tareas");
}

/** Responde una pregunta de un estudiante. */
export async function answerQuestion(questionId: string, response: string) {
  await requireTeacher();
  const supabase = await createClient();
  const { error } = await supabase
    .from("student_questions")
    .update({ teacher_response: response, is_read: true })
    .eq("id", questionId);
  if (error) throw new Error(error.message);
  revalidatePath("/preguntas");
}
