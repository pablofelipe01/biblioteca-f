"use server";

import { createClient } from "@/lib/supabase/server";
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
