import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import ResourceEditor, { type EditableResource } from "@/components/ResourceEditor";
import NewResourceButton from "@/components/NewResourceButton";
import type { AccessLink } from "@/lib/types";
import { ChevronLeft, ChevronRight, Search, Library, CheckCircle2, User } from "lucide-react";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 24;

type SearchParams = Record<string, string | string[] | undefined>;
function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function AdminRecursosPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();

  const page = Math.max(1, parseInt(first(sp.page) ?? "1", 10) || 1);
  const q = (first(sp.q) ?? "").replace(/[,()%*]/g, " ").trim();

  // Métricas
  const [{ count: total }, { count: active }, { count: byTeacher }] =
    await Promise.all([
      supabase.from("resources").select("id", { count: "exact", head: true }),
      supabase
        .from("resources")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true),
      supabase
        .from("resources")
        .select("id", { count: "exact", head: true })
        .eq("source", "profesor"),
    ]);

  let query = supabase
    .from("resources")
    .select(
      "id, title, author, synopsis, genre, school_cycle, reading_experience, is_active, access_links",
      { count: "exact" },
    )
    .order("title", { ascending: true });
  if (q) query = query.or(`title.ilike.%${q}%,author.ilike.%${q}%`);

  const from = (page - 1) * PAGE_SIZE;
  query = query.range(from, from + PAGE_SIZE - 1);

  const { data, count } = await query;
  const resources = ((data as unknown as (EditableResource & {
    access_links: AccessLink[] | null;
  })[]) ?? []).map((r) => ({
    ...r,
    access_links: Array.isArray(r.access_links) ? r.access_links : [],
  }));
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  function pageHref(p: number): string {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    params.set("page", String(p));
    return `/admin/recursos?${params.toString()}`;
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Administrar recursos</h1>
        <NewResourceButton />
      </div>

      {/* Métricas */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        <Metric icon={<Library className="h-5 w-5" />} value={total ?? 0} label="Recursos" />
        <Metric icon={<CheckCircle2 className="h-5 w-5" />} value={active ?? 0} label="Activos" />
        <Metric icon={<User className="h-5 w-5" />} value={byTeacher ?? 0} label="De profesores" />
      </div>

      {/* Búsqueda */}
      <form className="mb-5 flex gap-2" action="/admin/recursos">
        <div className="relative flex-1">
          <Search className="text-muted pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Buscar por título o autor…"
            className="bg-card w-full rounded-xl border py-2.5 pl-9 pr-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        </div>
        <button
          type="submit"
          className="bg-adventure rounded-xl px-4 text-sm font-semibold text-white"
        >
          Buscar
        </button>
      </form>

      <p className="text-muted mb-3 text-sm">
        {(count ?? 0).toLocaleString("es")} resultado(s)
      </p>

      <div className="space-y-2">
        {resources.map((r) => (
          <ResourceEditor key={r.id} resource={r} />
        ))}
      </div>

      {totalPages > 1 && (
        <nav className="mt-8 flex items-center justify-center gap-3">
          {page > 1 ? (
            <Link
              href={pageHref(page - 1)}
              className="bg-card inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-sm font-medium hover:border-brand"
            >
              <ChevronLeft className="h-4 w-4" /> Anterior
            </Link>
          ) : (
            <span className="text-muted/50 inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-sm">
              <ChevronLeft className="h-4 w-4" /> Anterior
            </span>
          )}
          <span className="text-muted text-sm">
            Página {page} de {totalPages}
          </span>
          {page < totalPages ? (
            <Link
              href={pageHref(page + 1)}
              className="bg-card inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-sm font-medium hover:border-brand"
            >
              Siguiente <ChevronRight className="h-4 w-4" />
            </Link>
          ) : (
            <span className="text-muted/50 inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-sm">
              Siguiente <ChevronRight className="h-4 w-4" />
            </span>
          )}
        </nav>
      )}
    </div>
  );
}

function Metric({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
}) {
  return (
    <div className="bg-card flex flex-col items-center gap-1 rounded-2xl border p-4">
      <span className="bg-adventure flex h-9 w-9 items-center justify-center rounded-xl text-white">
        {icon}
      </span>
      <span className="text-xl font-bold">{value.toLocaleString("es")}</span>
      <span className="text-muted text-center text-xs">{label}</span>
    </div>
  );
}
