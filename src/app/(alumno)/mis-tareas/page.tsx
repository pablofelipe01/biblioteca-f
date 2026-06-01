import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth";
import ProgressBar from "@/components/ProgressBar";
import BookCover from "@/components/BookCover";
import { ClipboardList, CalendarClock, Play, CheckCircle2 } from "lucide-react";

export const dynamic = "force-dynamic";

interface Row {
  id: string;
  title: string;
  chapter_label: string | null;
  due_at: string | null;
  resource: {
    title: string;
    author: string | null;
    cover_url: string | null;
    isbn: string | null;
  } | null;
  missions: { count: number }[];
}

export default async function MisTareasPage() {
  const session = await getSessionProfile();
  const supabase = await createClient();

  const { data } = await supabase
    .from("assignments")
    .select(
      "id, title, chapter_label, due_at, resource:resources(title, author, cover_url, isbn), missions(count)",
    )
    .eq("is_published", true)
    .order("created_at", { ascending: false });

  const rows = (data as unknown as Row[] | null) ?? [];

  // Misiones completadas por aventura (entregas calificadas del alumno).
  const done = new Map<string, Set<string>>();
  if (session && rows.length > 0) {
    const { data: subs } = await supabase
      .from("submissions")
      .select("mission_id, mission:missions!inner(assignment_id)")
      .eq("student_id", session.userId)
      .eq("status", "graded");
    for (const s of (subs as unknown as {
      mission_id: string;
      mission: { assignment_id: string } | null;
    }[] | null) ?? []) {
      const aid = s.mission?.assignment_id;
      if (!aid) continue;
      const set = done.get(aid) ?? new Set<string>();
      set.add(s.mission_id);
      done.set(aid, set);
    }
  }

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-bold">Mis tareas</h1>
        <p className="text-muted text-sm">Tus aventuras lectoras asignadas</p>
      </div>

      {rows.length === 0 ? (
        <div className="text-muted flex flex-col items-center gap-2 rounded-2xl border border-dashed py-16">
          <ClipboardList className="h-8 w-8" />
          <p>No tienes tareas asignadas todavía.</p>
          <Link href="/catalogo" className="font-medium text-brand">
            Explorar el catálogo
          </Link>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {rows.map((a) => {
            const total = a.missions?.[0]?.count ?? 0;
            const completed = done.get(a.id)?.size ?? 0;
            const isDone = total > 0 && completed >= total;
            return (
              <li key={a.id}>
                <Link
                  href={`/aventura/${a.id}`}
                  className="bg-card flex gap-3 rounded-2xl border p-3 transition hover:border-brand hover:shadow-sm"
                >
                  <div className="h-28 w-20 shrink-0 overflow-hidden rounded-lg bg-background">
                    <BookCover
                      title={a.resource?.title ?? a.title}
                      author={a.resource?.author}
                      isbn={a.resource?.isbn}
                      coverUrl={a.resource?.cover_url}
                    />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <h2 className="line-clamp-2 font-semibold">{a.title}</h2>
                    {a.chapter_label && (
                      <p className="text-muted text-xs">{a.chapter_label}</p>
                    )}
                    {a.due_at && (
                      <p className="text-muted mt-0.5 inline-flex items-center gap-1 text-xs">
                        <CalendarClock className="h-3 w-3" />
                        {new Date(a.due_at).toLocaleDateString("es")}
                      </p>
                    )}
                    <div className="mt-auto pt-2">
                      <ProgressBar value={completed} max={total} />
                      <span
                        className={`mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                          isDone
                            ? "bg-green-50 text-success"
                            : "bg-brand/10 text-brand"
                        }`}
                      >
                        {isDone ? (
                          <>
                            <CheckCircle2 className="h-3.5 w-3.5" /> ¡Completada!
                          </>
                        ) : (
                          <>
                            <Play className="h-3.5 w-3.5" />
                            {completed === 0 ? "Empezar" : "Continuar"} aventura
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
