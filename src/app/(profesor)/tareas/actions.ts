"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth";
import { fromNota } from "@/lib/grades";
import { MAX_IMAGES } from "@/lib/images";
import type { GroupMode, MissionType, Profile } from "@/lib/types";

export interface MissionInput {
  /** Presente al editar una misión que ya existe. */
  id?: string;
  mission_number: number;
  type: MissionType;
  title: string;
  points: number;
  data: Record<string, unknown>;
  reference_images?: string[];
}

export interface GroupSettingsInput {
  is_group: boolean;
  group_mode: GroupMode;
  group_max_size: number | null;
  /** Grupos a crear si la tarea aún no tiene ninguno. */
  group_count: number;
}

export interface NewAssignmentInput extends GroupSettingsInput {
  resource_id: string | null;
  title: string;
  chapter_label: string | null;
  instructions: string | null;
  excerpt_text: string;
  grade: string | null;
  due_at: string | null; // ISO o null
  reference_images: string[];
  missions: MissionInput[];
  publish: boolean;
}

export type UpdateAssignmentInput = Omit<NewAssignmentInput, "publish">;

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

/** Rutas de imágenes aceptables: del bucket de la institución, carpeta de referencias. */
function cleanRefImages(paths: string[] | undefined, orgId: string | null): string[] {
  if (!orgId) return [];
  return (paths ?? [])
    .filter((p) => typeof p === "string" && p.startsWith(`${orgId}/refs/`) && !p.includes(".."))
    .slice(0, MAX_IMAGES);
}

function assignmentFields(input: UpdateAssignmentInput, orgId: string | null) {
  if (!input.title?.trim()) throw new Error("El título es obligatorio.");
  if (!input.excerpt_text?.trim()) throw new Error("El fragmento es obligatorio.");
  const maxSize =
    input.group_max_size != null && input.group_max_size > 0
      ? Math.round(input.group_max_size)
      : null;
  return {
    resource_id: input.resource_id,
    title: input.title.trim(),
    chapter_label: input.chapter_label,
    instructions: input.instructions,
    excerpt_text: input.excerpt_text,
    grade: input.grade?.trim() || null,
    due_at: input.due_at,
    reference_images: cleanRefImages(input.reference_images, orgId),
    is_group: input.is_group,
    group_mode: input.group_mode === "self" ? "self" : "teacher",
    group_max_size: maxSize,
  };
}

function missionRow(m: MissionInput, index: number, orgId: string | null) {
  return {
    mission_number: index + 1,
    type: m.type,
    title: m.title,
    points: m.points,
    data: m.data,
    reference_images: cleanRefImages(m.reference_images, orgId),
  };
}

type Db = Awaited<ReturnType<typeof createClient>>;

/** Crea los grupos 1..count si la tarea grupal todavía no tiene grupos. */
async function ensureGroups(supabase: Db, assignmentId: string, count: number) {
  const { count: existing } = await supabase
    .from("assignment_groups")
    .select("id", { count: "exact", head: true })
    .eq("assignment_id", assignmentId);
  if ((existing ?? 0) > 0) return;
  const n = Math.min(Math.max(Math.round(count) || 0, 1), 30);
  const { error } = await supabase.from("assignment_groups").insert(
    Array.from({ length: n }, (_, i) => ({
      assignment_id: assignmentId,
      number: i + 1,
    })),
  );
  if (error) throw new Error(error.message);
}

/** Crea la asignación + sus misiones. Devuelve el id (redirige a su detalle). */
export async function createAssignmentWithMissions(input: NewAssignmentInput) {
  const { userId, profile } = await requireTeacher();
  const supabase = await createClient();

  const { data: assignment, error } = await supabase
    .from("assignments")
    .insert({
      ...assignmentFields(input, profile.org_id),
      org_id: profile.org_id,
      teacher_id: userId,
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
      ...missionRow(m, i, profile.org_id),
    }));
    const { error: mErr } = await supabase.from("missions").insert(rows);
    if (mErr) throw new Error(mErr.message);
  }

  if (input.is_group) await ensureGroups(supabase, assignment.id, input.group_count);

  revalidatePath("/tareas");
  redirect(`/tareas/${assignment.id}`);
}

/**
 * Edita la tarea completa: datos, imágenes, configuración grupal y misiones.
 * Las misiones que ya no vienen se eliminan (y con ellas sus entregas).
 */
export async function updateAssignment(assignmentId: string, input: UpdateAssignmentInput) {
  const { profile } = await requireTeacher();
  const supabase = await createClient();

  if (input.missions.length === 0) {
    throw new Error("La tarea debe tener al menos una misión.");
  }

  const { data: updated, error } = await supabase
    .from("assignments")
    .update({
      ...assignmentFields(input, profile.org_id),
      updated_at: new Date().toISOString(),
    })
    .eq("id", assignmentId)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!updated) throw new Error("Tarea no encontrada.");

  const { data: current } = await supabase
    .from("missions")
    .select("id")
    .eq("assignment_id", assignmentId);
  const currentIds = new Set((current ?? []).map((m) => m.id as string));
  const keptIds = new Set(
    input.missions.map((m) => m.id).filter((id): id is string => !!id && currentIds.has(id)),
  );

  const toDelete = [...currentIds].filter((id) => !keptIds.has(id));
  if (toDelete.length > 0) {
    const { error: dErr } = await supabase.from("missions").delete().in("id", toDelete);
    if (dErr) throw new Error(dErr.message);
  }

  for (const [i, m] of input.missions.entries()) {
    const row = missionRow(m, i, profile.org_id);
    if (m.id && keptIds.has(m.id)) {
      const { error: uErr } = await supabase.from("missions").update(row).eq("id", m.id);
      if (uErr) throw new Error(uErr.message);
    } else {
      const { error: iErr } = await supabase
        .from("missions")
        .insert({ ...row, assignment_id: assignmentId });
      if (iErr) throw new Error(iErr.message);
    }
  }

  if (input.is_group) await ensureGroups(supabase, assignmentId, input.group_count);

  revalidatePath(`/tareas/${assignmentId}`);
  revalidatePath("/tareas");
  redirect(`/tareas/${assignmentId}`);
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

// ============ GRUPOS ============

/** Agrega el siguiente grupo numerado a una tarea grupal. */
export async function addGroup(assignmentId: string) {
  await requireTeacher();
  const supabase = await createClient();
  const { data: last } = await supabase
    .from("assignment_groups")
    .select("number")
    .eq("assignment_id", assignmentId)
    .order("number", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase
    .from("assignment_groups")
    .insert({ assignment_id: assignmentId, number: (last?.number ?? 0) + 1 });
  if (error) throw new Error(error.message);
  revalidatePath(`/tareas/${assignmentId}`);
}

/** Elimina un grupo; sus integrantes quedan sin grupo. */
export async function removeGroup(assignmentId: string, groupId: string) {
  await requireTeacher();
  const supabase = await createClient();
  const { error } = await supabase
    .from("assignment_groups")
    .delete()
    .eq("id", groupId)
    .eq("assignment_id", assignmentId);
  if (error) throw new Error(error.message);
  revalidatePath(`/tareas/${assignmentId}`);
}

/** Asigna (o quita, con groupId null) a un estudiante de un grupo. */
export async function setGroupMember(
  assignmentId: string,
  studentId: string,
  groupId: string | null,
) {
  await requireTeacher();
  const supabase = await createClient();
  if (!groupId) {
    const { error } = await supabase
      .from("assignment_group_members")
      .delete()
      .eq("assignment_id", assignmentId)
      .eq("student_id", studentId);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("assignment_group_members").upsert(
      { assignment_id: assignmentId, student_id: studentId, group_id: groupId },
      { onConflict: "assignment_id,student_id" },
    );
    if (error) throw new Error(error.message);
  }
  revalidatePath(`/tareas/${assignmentId}`);
}

// ============ REVISIÓN DE ENTREGAS ============

/**
 * Guarda la revisión del docente sobre una entrega: nota (1.0–5.0, se guarda
 * como 0–100; null la quita y vuelve a mandar la de IA) y comentario libre.
 */
export async function saveTeacherReview(
  submissionId: string,
  review: { nota: number | null; comment: string },
) {
  await requireTeacher();
  const supabase = await createClient();
  const comment = review.comment.trim();
  if (review.nota != null && (Number.isNaN(review.nota) || review.nota < 1 || review.nota > 5)) {
    throw new Error("La nota debe estar entre 1.0 y 5.0.");
  }
  const { data, error } = await supabase
    .from("submissions")
    .update({
      teacher_score: review.nota == null ? null : fromNota(review.nota),
      teacher_comment: comment || null,
      teacher_commented_at: comment ? new Date().toISOString() : null,
      status: "graded",
    })
    .eq("id", submissionId)
    .select("mission:missions(assignment_id)")
    .maybeSingle();
  if (error) throw new Error(error.message);
  const aid = (data?.mission as unknown as { assignment_id: string } | null)?.assignment_id;
  if (aid) revalidatePath(`/tareas/${aid}`);
  revalidatePath("/reportes");
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
