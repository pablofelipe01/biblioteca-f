"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionProfile } from "@/lib/auth";

/** El alumno deja una pregunta al profesor sobre una aventura. */
export async function askTeacher(assignmentId: string, question: string) {
  const session = await getSessionProfile();
  if (!session?.profile || session.profile.role !== "alumno") {
    throw new Error("No autorizado");
  }
  const q = question.trim();
  if (!q) throw new Error("Escribe tu pregunta.");

  const supabase = await createClient();
  const { error } = await supabase.from("student_questions").insert({
    student_id: session.userId,
    assignment_id: assignmentId,
    question: q,
  });
  if (error) throw new Error(error.message);
}

/**
 * El alumno elige (o cambia) su grupo en una tarea grupal de autoinscripción.
 * La visibilidad de la tarea se valida con la sesión (RLS); la escritura se hace
 * con la service key porque el alumno no tiene permiso directo sobre integrantes.
 */
export async function joinGroup(assignmentId: string, groupId: string) {
  const session = await getSessionProfile();
  if (!session?.profile || session.profile.role !== "alumno") {
    throw new Error("No autorizado");
  }

  const supabase = await createClient();
  const { data: assignment } = await supabase
    .from("assignments")
    .select("id, is_group, group_mode, group_max_size")
    .eq("id", assignmentId)
    .maybeSingle();
  if (!assignment) throw new Error("Tarea no disponible.");
  if (!assignment.is_group || assignment.group_mode !== "self") {
    throw new Error("En esta tarea los grupos los asigna tu profe.");
  }

  const admin = createAdminClient();
  const { data: group } = await admin
    .from("assignment_groups")
    .select("id, assignment_id")
    .eq("id", groupId)
    .maybeSingle();
  if (!group || group.assignment_id !== assignmentId) {
    throw new Error("Ese grupo no existe.");
  }

  if (assignment.group_max_size != null) {
    const { count } = await admin
      .from("assignment_group_members")
      .select("id", { count: "exact", head: true })
      .eq("group_id", groupId)
      .neq("student_id", session.userId);
    if ((count ?? 0) >= assignment.group_max_size) {
      throw new Error("Ese grupo ya está completo. Elige otro.");
    }
  }

  const { error } = await admin.from("assignment_group_members").upsert(
    {
      assignment_id: assignmentId,
      group_id: groupId,
      student_id: session.userId,
    },
    { onConflict: "assignment_id,student_id" },
  );
  if (error) throw new Error(error.message);

  revalidatePath(`/aventura/${assignmentId}`);
}
