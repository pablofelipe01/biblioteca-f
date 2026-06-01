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

  let initialResource = null;
  if (resourceId) {
    const supabase = await createClient();
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

  return <NewAssignmentForm initialResource={initialResource} />;
}
