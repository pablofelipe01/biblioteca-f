import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Assignment } from "@/lib/types";
import { Plus, ClipboardList, CalendarClock, GraduationCap, CheckCircle2, FileEdit } from "lucide-react";

export const dynamic = "force-dynamic";

type Row = Assignment & { missions: { count: number }[] };

export default async function TareasPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("assignments")
    .select("*, missions(count)")
    .order("created_at", { ascending: false });

  const rows = (data as Row[] | null) ?? [];

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Mis tareas</h1>
          <p className="text-muted text-sm">{rows.length} tarea(s)</p>
        </div>
        <Link
          href="/tareas/nueva"
          className="bg-adventure inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white"
        >
          <Plus className="h-4 w-4" /> Nueva tarea
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="text-muted flex flex-col items-center gap-2 rounded-2xl border border-dashed py-16">
          <ClipboardList className="h-8 w-8" />
          <p>Aún no has creado tareas.</p>
          <Link href="/tareas/nueva" className="font-medium text-brand">
            Crear la primera
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((a) => (
            <li key={a.id}>
              <Link
                href={`/tareas/${a.id}`}
                className="bg-card flex flex-col gap-2 rounded-2xl border p-4 transition hover:border-brand hover:shadow-sm sm:flex-row sm:items-center"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold">{a.title}</h2>
                    {a.is_published ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-success">
                        <CheckCircle2 className="h-3 w-3" /> Publicada
                      </span>
                    ) : (
                      <span className="text-muted inline-flex items-center gap-1 rounded-full bg-background px-2 py-0.5 text-xs font-medium">
                        <FileEdit className="h-3 w-3" /> Borrador
                      </span>
                    )}
                  </div>
                  {a.chapter_label && (
                    <p className="text-muted text-xs">{a.chapter_label}</p>
                  )}
                </div>
                <div className="text-muted flex flex-wrap items-center gap-3 text-xs">
                  {a.grade && (
                    <span className="inline-flex items-center gap-1">
                      <GraduationCap className="h-3.5 w-3.5" /> {a.grade}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1">
                    <ClipboardList className="h-3.5 w-3.5" />
                    {a.missions?.[0]?.count ?? 0} misión(es)
                  </span>
                  {a.due_at && (
                    <span className="inline-flex items-center gap-1">
                      <CalendarClock className="h-3.5 w-3.5" />
                      {new Date(a.due_at).toLocaleDateString("es")}
                    </span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
