import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import BookCover from "@/components/BookCover";
import { DIVERSITY_TAGS, type AccessLink, type Resource } from "@/lib/types";
import { ArrowLeft, ExternalLink, PlusCircle, LinkIcon } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ResourceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { profile, email } = await requireProfile();
  const supabase = await createClient();

  const { data } = await supabase
    .from("resources")
    .select("*")
    .eq("id", id)
    .single();

  if (!data) notFound();
  const r = data as Resource;
  const links: AccessLink[] = Array.isArray(r.access_links)
    ? r.access_links
    : [];
  const activeTags = DIVERSITY_TAGS.filter((t) => r[t.key]);

  const meta: [string, string | null][] = [
    ["Autor", r.author],
    ["Ilustrador/es", r.illustrator],
    ["Editorial", r.publisher],
    ["Edición", r.edition],
    ["Ciudad", r.city],
    ["Publicación", r.published_year],
    ["Páginas", r.pages ? String(r.pages) : null],
    ["Género", r.genre],
    ["Áreas fundamentales", r.fundamental_areas],
    ["Ciclo escolar", r.school_cycle],
    ["Experiencia lectora", r.reading_experience],
    ["Nacionalidad del autor", r.author_nationality],
    ["Colección editorial", r.editorial_collection],
    ["Colección", r.collection],
    ["ISBN", r.isbn],
  ];

  return (
    <AppShell profile={profile} email={email}>
      <Link
        href="/catalogo"
        className="text-muted mb-4 inline-flex items-center gap-1 text-sm hover:text-brand"
      >
        <ArrowLeft className="h-4 w-4" /> Volver al catálogo
      </Link>

      <div className="grid gap-6 md:grid-cols-[220px_1fr]">
        {/* Portada + acciones */}
        <div className="space-y-4">
          <div className="aspect-[3/4] overflow-hidden rounded-2xl border bg-background shadow-sm">
            <BookCover
              title={r.title}
              author={r.author}
              isbn={r.isbn}
              coverUrl={r.cover_url}
            />
          </div>

          {(profile.role === "profesor" || profile.role === "admin") && (
            <Link
              href={`/tareas/nueva?resource=${r.id}`}
              className="bg-adventure flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 font-semibold text-white transition hover:opacity-95"
            >
              <PlusCircle className="h-4 w-4" />
              Asignar como tarea
            </Link>
          )}
        </div>

        {/* Ficha */}
        <div>
          <h1 className="text-2xl font-bold">{r.title}</h1>
          {r.author && <p className="text-muted mt-1">{r.author}</p>}

          {activeTags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {activeTags.map((t) => (
                <span
                  key={t.key}
                  className="rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-medium text-brand"
                >
                  {t.label}
                </span>
              ))}
            </div>
          )}

          {r.synopsis && (
            <div className="bg-card mt-5 rounded-2xl border p-4">
              <h2 className="mb-1 font-semibold">Reseña</h2>
              <p className="text-sm leading-relaxed">{r.synopsis}</p>
            </div>
          )}

          {/* Enlaces legales */}
          <div className="bg-card mt-4 rounded-2xl border p-4">
            <h2 className="mb-2 flex items-center gap-2 font-semibold">
              <LinkIcon className="h-4 w-4" /> Dónde leerlo (enlaces legales)
            </h2>
            {links.length === 0 ? (
              <p className="text-muted text-sm">
                Aún no hay enlaces legales registrados para este título. No
                alojamos obras con derechos de autor; un administrador puede
                añadir enlaces a fuentes legales.
              </p>
            ) : (
              <ul className="space-y-1">
                {links.map((l, i) => (
                  <li key={i}>
                    <a
                      href={l.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm font-medium text-brand-2 hover:underline"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      {l.label || l.url}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Metadatos */}
          <dl className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-2">
            {meta
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k} className="flex flex-col border-b py-1.5">
                  <dt className="text-muted text-xs">{k}</dt>
                  <dd className="text-sm">{v}</dd>
                </div>
              ))}
          </dl>

          {r.keywords && r.keywords.length > 0 && (
            <div className="mt-4">
              <h3 className="text-muted mb-1 text-xs">Palabras clave</h3>
              <div className="flex flex-wrap gap-1.5">
                {r.keywords.map((k) => (
                  <span
                    key={k}
                    className="rounded-full border px-2 py-0.5 text-xs"
                  >
                    {k}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
