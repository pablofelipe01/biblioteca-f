"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth";
import type { AccessLink, Profile } from "@/lib/types";

export interface ResourceInput {
  title: string;
  author: string | null;
  synopsis: string | null;
  genre: string | null;
  school_cycle: string | null;
  reading_experience: string | null;
  is_active: boolean;
  access_links: AccessLink[];
}

async function requireAdmin(): Promise<{
  userId: string;
  email: string | null;
  profile: Profile;
}> {
  const session = await getSessionProfile();
  if (!session?.profile || session.profile.role !== "admin") {
    throw new Error("No autorizado");
  }
  return { userId: session.userId, email: session.email, profile: session.profile };
}

function clean(input: ResourceInput) {
  return {
    title: input.title.trim(),
    author: input.author?.trim() || null,
    synopsis: input.synopsis?.trim() || null,
    genre: input.genre?.trim() || null,
    school_cycle: input.school_cycle?.trim() || null,
    reading_experience: input.reading_experience?.trim() || null,
    is_active: input.is_active,
    access_links: (input.access_links ?? [])
      .filter((l) => l.url?.trim())
      .map((l) => ({
        label: l.label?.trim() || l.url.trim(),
        url: l.url.trim(),
        type: l.type?.trim() || undefined,
      })),
  };
}

export async function createResource(input: ResourceInput) {
  const { profile, userId } = await requireAdmin();
  if (!input.title?.trim()) throw new Error("El título es obligatorio.");
  const supabase = await createClient();
  const { error } = await supabase.from("resources").insert({
    ...clean(input),
    source: "catalogo",
    org_id: profile.org_id, // recurso de la institución del admin
    created_by: userId,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/recursos");
}

export async function updateResource(id: string, input: ResourceInput) {
  await requireAdmin();
  if (!input.title?.trim()) throw new Error("El título es obligatorio.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("resources")
    .update(clean(input))
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/recursos");
}

export async function deleteResource(id: string) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("resources").delete().eq("id", id);
  if (error) {
    // FK: el recurso puede estar referenciado por una tarea.
    if (/foreign key|violates/i.test(error.message)) {
      throw new Error("No se puede eliminar: el recurso está en uso por una tarea.");
    }
    throw new Error(error.message);
  }
  revalidatePath("/admin/recursos");
}
