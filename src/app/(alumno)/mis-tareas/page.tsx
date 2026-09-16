import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth";
import ProgressBar from "@/components/ProgressBar";
import BookCover from "@/components/BookCover";
import { computeTaskResult, effectiveScore, formatNota, notaTone } from "@/lib/grades";
import { ClipboardList, CalendarClock, Play, CheckCircle2, Users } from "lucide-react";

export const dynamic = "force-dynamic";

interface Row {
  id: string;
  title: string;
  chapter_label: string | null;
  due_at: string | null;
  is_group: boolean | null;
  resource: {
    title: string;
    author: string | null;
    cover_url: string | null;
    isbn: string | null;
  } | null;
  missions: { id: string }[];
}

export default async function MisTareasPage() {
  const session = await getSessionProfile();
  const supabase = await createClient();

  const { data } = await supabase
    .from("assignments")
    .select(
      "id, title, chapter_label, due_at, is_group, resource:resources(title, author, cover_url, isbn), missions(id)",
    )
    .eq("is_published", true)
    .order("created_at", { ascending: false });

  const rows = (data as unknown as Row[] | null) ?? [];

  // Puntaje efectivo por misión (entregas calificadas del alumno).
  const scores = new Map<string, number | null>();
  if (session && rows.length > 0) {
    const { data: subs } = await supabase
      .from("submissions")
      .select("mission_id, ai_score, teacher_score")
      .eq("student_id", session.userId)
      .eq("status", "graded");
    for (const s of (subs as {
      mission_id: string;
      ai_score: number | null;
      teacher_score: number | null;
    }[] | null) ?? []) {
      scores.set(s.mission_id, effectiveScore(s));
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
            const result = computeTaskResult(
              (a.missions ?? []).map((m) => m.id),
              scores,
              { dueAt: a.due_at },
            );
            const total = result.total;
            const completed = result.answered;
            const isDone = result.finished;
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
                    <div className="flex items-start gap-2">
                      <h2 className="line-clamp-2 flex-1 font-semibold">{a.title}</h2>
                      {result.nota != null && (
                        <span className="shrink-0 text-right">
                          <span className={`block text-lg font-bold leading-none ${notaTone(result.nota)}`}>
                            {formatNota(result.nota)}
                          </span>
                          <span className="text-muted text-[10px]">nota</span>
                        </span>
                      )}
                    </div>
                    {a.is_group && (
                      <span className="mt-0.5 inline-flex w-fit items-center gap-1 rounded-full bg-brand-2/10 px-2 py-0.5 text-[11px] font-semibold text-brand-2">
                        <Users className="h-3 w-3" /> Grupal
                      </span>
                    )}
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
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <ProgressBar value={completed} max={total} showLabel={false} />
                        </div>
                        <span className="text-muted text-xs font-semibold">
                          {result.percent}%
                        </span>
                      </div>
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
