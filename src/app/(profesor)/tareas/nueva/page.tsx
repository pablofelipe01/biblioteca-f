import { createClient } from "@/lib/supabase/server";
import NewAssignmentForm from "./NewAssignmentForm";
import type { Resource } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function NuevaTareaPage({
  searchParams,
}: {
  searchParams: Promise<{ resource?: string }>;
}) {
  const { resource: resourceId } = await searchParams;
  const supabase = await createClient();

  let initialResource = null;
  if (resourceId) {
    const { data } = await supabase
      .from("resources")
      .select("id, title, author, school_cycle, reading_experience")
      .eq("id", resourceId)
      .single();
    initialResource = (data as Pick<
      Resource,
      "id" | "title" | "author" | "school_cycle" | "reading_experience"
    > | null);
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
    <NewAssignmentForm
      initialResource={initialResource}
      availableGrades={availableGrades}
    />
  );
}
