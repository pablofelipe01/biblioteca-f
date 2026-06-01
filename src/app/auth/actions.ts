"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Server Action: cierra la sesión y vuelve a /login. */
export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
