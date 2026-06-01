import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import ResourceCard from "@/components/ResourceCard";
import CatalogFilters from "@/components/CatalogFilters";
import { DIVERSITY_TAGS, type Resource } from "@/lib/types";
import { ChevronLeft, ChevronRight, BookX } from "lucide-react";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 24;
const DIVERSITY_KEYS = DIVERSITY_TAGS.map((t) => t.key);

type SearchParams = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

// Quita caracteres que romperían el filtro .or() de PostgREST.
function sanitize(q: string): string {
  return q.replace(/[,()%*]/g, " ").trim();
}

export default async function CatalogoPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { profile, email } = await requireProfile();
  const sp = await searchParams;
  const supabase = await createClient();

  const page = Math.max(1, parseInt(first(sp.page) ?? "1", 10) || 1);
  const q = sanitize(first(sp.q) ?? "");
  const ciclo = first(sp.ciclo);
  const experiencia = first(sp.experiencia);
  const genero = first(sp.genero);
  const area = first(sp.area);

  let query = supabase
    .from("resources")
    .select("*", { count: "exact" })
    .eq("is_active", true)
    .order("title", { ascending: true });

  if (q) query = query.or(`title.ilike.%${q}%,author.ilike.%${q}%`);
  if (ciclo) query = query.eq("school_cycle", ciclo);
  if (experiencia) query = query.eq("reading_experience", experiencia);
  if (genero) query = query.eq("genre", genero);
  if (area) query = query.eq("fundamental_areas", area);
  for (const key of DIVERSITY_KEYS) {
    if (first(sp[key]) === "1") query = query.eq(key, true);
  }

  const from = (page - 1) * PAGE_SIZE;
  query = query.range(from, from + PAGE_SIZE - 1);

  const { data, count, error } = await query;
  const resources = (data as Resource[] | null) ?? [];
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Facetas (géneros y áreas) desde la BD.
  let genres: string[] = [];
  let areas: string[] = [];
  const { data: facets } = await supabase.rpc("catalog_facets");
  if (facets) {
    genres = (facets.genres as string[]) ?? [];
    areas = (facets.areas as string[]) ?? [];
  }

  // Construye un href conservando filtros y cambiando page.
  function pageHref(p: number): string {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) {
      const val = first(v);
      if (val && k !== "page") params.set(k, val);
    }
    params.set("page", String(p));
    return `/catalogo?${params.toString()}`;
  }

  return (
    <AppShell profile={profile} email={email}>
      <div className="mb-5">
        <h1 className="text-2xl font-bold">Catálogo</h1>
        <p className="text-muted text-sm">
          {total.toLocaleString("es")} título(s) del Plan Nacional de Lectura
        </p>
      </div>

      <div className="mb-6">
        <CatalogFilters genres={genres} areas={areas} />
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-danger">
          No se pudo cargar el catálogo: {error.message}
        </p>
      )}

      {resources.length === 0 ? (
        <div className="text-muted flex flex-col items-center gap-2 rounded-2xl border border-dashed py-16">
          <BookX className="h-8 w-8" />
          <p>No hay resultados con esos filtros.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {resources.map((r) => (
            <ResourceCard key={r.id} resource={r} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <nav className="mt-8 flex items-center justify-center gap-3">
          <PageLink href={pageHref(page - 1)} disabled={page <= 1}>
            <ChevronLeft className="h-4 w-4" /> Anterior
          </PageLink>
          <span className="text-muted text-sm">
            Página {page} de {totalPages}
          </span>
          <PageLink href={pageHref(page + 1)} disabled={page >= totalPages}>
            Siguiente <ChevronRight className="h-4 w-4" />
          </PageLink>
        </nav>
      )}
    </AppShell>
  );
}

function PageLink({
  href,
  disabled,
  children,
}: {
  href: string;
  disabled: boolean;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span className="text-muted/50 inline-flex cursor-not-allowed items-center gap-1 rounded-xl border px-3 py-2 text-sm">
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className="bg-card inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-sm font-medium transition hover:border-brand"
    >
      {children}
    </Link>
  );
}
