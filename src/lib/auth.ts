import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

/**
 * Devuelve el usuario autenticado y su perfil (rol, org, etc.), o null.
 * Úsalo en Server Components y Route Handlers para autorizar.
 */
export async function getSessionProfile(): Promise<{
  userId: string;
  email: string | null;
  profile: Profile | null;
} | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return {
    userId: user.id,
    email: user.email ?? null,
    profile: (profile as Profile) ?? null,
  };
}

/** Exige sesión; si no hay, redirige a /login. Devuelve perfil garantizado. */
export async function requireProfile(): Promise<{
  userId: string;
  email: string | null;
  profile: Profile;
}> {
  const session = await getSessionProfile();
  if (!session) redirect("/login");
  if (!session.profile) {
    // Perfil aún no creado (trigger). Tratamos como sesión incompleta.
    redirect("/login?error=perfil");
  }
  return session as {
    userId: string;
    email: string | null;
    profile: Profile;
  };
}

/** Exige un rol concreto; si no coincide, redirige al home. */
export async function requireRole(
  roles: Profile["role"][],
): Promise<{ userId: string; email: string | null; profile: Profile }> {
  const session = await requireProfile();
  if (!roles.includes(session.profile.role)) redirect("/");
  return session;
}
