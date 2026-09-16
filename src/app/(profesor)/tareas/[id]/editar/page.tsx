import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth";
import { signImagePaths, toSignedList } from "@/lib/images-server";
import NewAssignmentForm, {
  type PickedResource,
} from "../../nueva/NewAssignmentForm";
import type { Assignment, Mission } from "@/lib/types";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function EditarTareaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const session = await getSessionProfile();

  const { data } = await supabase
    .from("assignments")
    .select(
      "*, resource:resources(id, title, author, school_cycle, reading_experience)",
    )
    .eq("id", id)
    .single();
  if (!data) notFound();
  const assignment = data as Assignment & { resource: PickedResource | null };

  const { data: missionsData } = await supabase
    .from("missions")
    .select("*")
    .eq("assignment_id", id)
    .order("mission_number", { ascending: true });
  const missions = (missionsData as Mission[] | null) ?? [];

  const submissionCounts: Record<string, number> = {};
  if (missions.length > 0) {
    const { data: subs } = await supabase
      .from("submissions")
      .select("mission_id")
      .in(
        "mission_id",
        missions.map((m) => m.id),
      );
    for (const s of (subs as { mission_id: string }[] | null) ?? []) {
      submissionCounts[s.mission_id] = (submissionCounts[s.mission_id] ?? 0) + 1;
    }
  }

  const { count: groupCount } = await supabase
    .from("assignment_groups")
    .select("id", { count: "exact", head: true })
    .eq("assignment_id", id);

  const urls = await signImagePaths([
    ...(assignment.reference_images ?? []),
    ...missions.flatMap((m) => m.reference_images ?? []),
  ]);

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
        href={`/tareas/${id}`}
        className="text-muted mb-4 inline-flex items-center gap-1 text-sm hover:text-brand"
      >
        <ArrowLeft className="h-4 w-4" /> Volver a la tarea
      </Link>
      <NewAssignmentForm
        initialResource={assignment.resource}
        availableGrades={availableGrades}
        orgId={session?.profile?.org_id ?? null}
        editing={{
          id: assignment.id,
          title: assignment.title,
          chapter_label: assignment.chapter_label,
          instructions: assignment.instructions,
          excerpt_text: assignment.excerpt_text ?? "",
          grade: assignment.grade,
          due_at: assignment.due_at,
          reference_images: toSignedList(assignment.reference_images, urls),
          is_group: assignment.is_group ?? false,
          group_mode: assignment.group_mode ?? "teacher",
          group_max_size: assignment.group_max_size ?? null,
          group_count: groupCount ?? 0,
          missions: missions.map((m) => ({
            id: m.id,
            mission_number: m.mission_number,
            type: m.type,
            title: m.title ?? "",
            points: m.points,
            data: m.data as unknown as Record<string, unknown>,
            reference_images: m.reference_images ?? [],
            images: toSignedList(m.reference_images, urls),
          })),
          submissionCounts,
        }}
      />
    </div>
  );
}
