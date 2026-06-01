import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import AppShell from "@/components/AppShell";
import { createClient } from "@/lib/supabase/server";
import {
  Library,
  ClipboardList,
  Trophy,
  MessageCircleQuestion,
  ArrowRight,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { profile, email } = await requireProfile();
  const supabase = await createClient();

  // Conteos ligeros para el panel (RLS limita lo que cada rol ve).
  const tareasCount =
    profile.role === "alumno" || profile.role === "profesor"
      ? ((await supabase
          .from("assignments")
          .select("id", { count: "exact", head: true })).count ?? 0)
      : 0;

  return (
    <AppShell profile={profile} email={email}>
      <section className="bg-card mb-6 rounded-2xl border p-6">
        <h1 className="text-2xl font-bold">
          ¡Hola{profile.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}! 👋
        </h1>
        <p className="text-muted mt-1">
          {profile.role === "alumno"
            ? "Tus aventuras lectoras te esperan."
            : profile.role === "profesor"
              ? "Gestiona lecturas y acompaña a tus estudiantes."
              : "Panel de administración de la biblioteca."}
        </p>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {profile.role === "alumno" && (
          <>
            <DashCard
              href="/mis-tareas"
              title="Mis tareas"
              desc={`${tareasCount} asignada(s) — continúa tu aventura`}
              icon={<ClipboardList className="h-5 w-5" />}
            />
            <DashCard
              href="/catalogo"
              title="Explorar catálogo"
              desc="Descubre miles de libros para leer"
              icon={<Library className="h-5 w-5" />}
            />
            <DashCard
              href="/progreso"
              title="Mi progreso"
              desc={`${profile.total_points} puntos · racha de ${profile.streak_days} día(s)`}
              icon={<Trophy className="h-5 w-5" />}
            />
          </>
        )}

        {profile.role === "profesor" && (
          <>
            <DashCard
              href="/tareas"
              title="Mis tareas"
              desc={`${tareasCount} tarea(s) creada(s)`}
              icon={<ClipboardList className="h-5 w-5" />}
            />
            <DashCard
              href="/tareas/nueva"
              title="Crear tarea"
              desc="Asigna una lectura y genera misiones con IA"
              icon={<ArrowRight className="h-5 w-5" />}
            />
            <DashCard
              href="/catalogo"
              title="Catálogo"
              desc="Busca títulos para asignar"
              icon={<Library className="h-5 w-5" />}
            />
            <DashCard
              href="/preguntas"
              title="Preguntas"
              desc="Responde dudas de tus estudiantes"
              icon={<MessageCircleQuestion className="h-5 w-5" />}
            />
          </>
        )}

        {profile.role === "admin" && (
          <>
            <DashCard
              href="/catalogo"
              title="Catálogo"
              desc="Explora y gestiona los recursos"
              icon={<Library className="h-5 w-5" />}
            />
            <DashCard
              href="/admin/recursos"
              title="Administrar recursos"
              desc="CRUD del catálogo y enlaces legales"
              icon={<ClipboardList className="h-5 w-5" />}
            />
          </>
        )}
      </div>

      {!profile.org_id && (
        <p className="mt-6 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Tu cuenta aún no está vinculada a una institución. Pide a un administrador
          que te asigne una <code>org_id</code> para ver tareas y recursos de tu colegio.
        </p>
      )}
    </AppShell>
  );
}

function DashCard({
  href,
  title,
  desc,
  icon,
}: {
  href: string;
  title: string;
  desc: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="bg-card group flex flex-col gap-2 rounded-2xl border p-5 transition hover:border-brand hover:shadow-md"
    >
      <span className="bg-adventure flex h-10 w-10 items-center justify-center rounded-xl text-white">
        {icon}
      </span>
      <span className="mt-1 font-semibold">{title}</span>
      <span className="text-muted text-sm">{desc}</span>
    </Link>
  );
}
