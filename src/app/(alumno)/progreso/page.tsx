import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth";
import BadgeChip from "@/components/BadgeChip";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadCourseResults, rankStudents } from "@/lib/course-results";
import { formatNota, notaTone, NOTA_APROBATORIA } from "@/lib/grades";
import type { Badge } from "@/lib/types";
import { Sparkles, Flame, Trophy, BookCheck, GraduationCap, Medal } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ProgresoPage() {
  const session = await getSessionProfile();
  const supabase = await createClient();

  // Perfil fresco (puntos/racha actualizados por el servidor).
  const { data: profile } = await supabase
    .from("profiles")
    .select("total_points, streak_days")
    .eq("id", session!.userId)
    .single();

  const { data: allBadges } = await supabase
    .from("badges")
    .select("id, code, name, description, icon")
    .order("code");

  const { data: mine } = await supabase
    .from("user_badges")
    .select("badge_id")
    .eq("student_id", session!.userId);

  const earnedIds = new Set(
    (mine as { badge_id: string }[] | null)?.map((b) => b.badge_id) ?? [],
  );
  const badges = (allBadges as Badge[] | null) ?? [];

  // Aventuras completadas.
  const { data: subs } = await supabase
    .from("submissions")
    .select("mission_id, mission:missions!inner(assignment_id)")
    .eq("student_id", session!.userId)
    .eq("status", "graded");

  const doneByAssignment = new Map<string, Set<string>>();
  for (const s of (subs as unknown as {
    mission_id: string;
    mission: { assignment_id: string } | null;
  }[] | null) ?? []) {
    const aid = s.mission?.assignment_id;
    if (!aid) continue;
    const set = doneByAssignment.get(aid) ?? new Set<string>();
    set.add(s.mission_id);
    doneByAssignment.set(aid, set);
  }
  const assignmentIds = [...doneByAssignment.keys()];
  const totalByAssignment = new Map<string, number>();
  if (assignmentIds.length > 0) {
    const { data: ms } = await supabase
      .from("missions")
      .select("assignment_id")
      .in("assignment_id", assignmentIds);
    for (const m of (ms as { assignment_id: string }[] | null) ?? []) {
      totalByAssignment.set(
        m.assignment_id,
        (totalByAssignment.get(m.assignment_id) ?? 0) + 1,
      );
    }
  }
  const completedAdventures = assignmentIds.filter((aid) => {
    const total = totalByAssignment.get(aid) ?? 0;
    return total > 0 && (doneByAssignment.get(aid)?.size ?? 0) >= total;
  }).length;

  const earnedCount = badges.filter((b) => earnedIds.has(b.id)).length;

  // Notas y ranking del curso. El servidor ya validó rol alumno (layout);
  // con la service key solo leemos su misma org y curso.
  const me = session!.profile;
  const course =
    me?.org_id && me.grade
      ? await loadCourseResults(createAdminClient(), { orgId: me.org_id, grade: me.grade })
      : null;
  const ranking = course ? rankStudents(course.students) : [];
  const myRow = ranking.find((r) => r.student.id === session!.userId) ?? null;
  const myTasks = course
    ? course.tasks
        .filter((t) => myRow?.tasks[t.id])
        .map((t) => ({ task: t, result: myRow!.tasks[t.id] }))
        .reverse()
    : [];
  const ranked = ranking.filter((r) => r.position != null);

  return (
    <div>
      <h1 className="mb-5 text-2xl font-bold">Mi progreso</h1>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat icon={<Sparkles className="h-5 w-5" />} value={profile?.total_points ?? 0} label="Puntos" />
        <Stat icon={<Flame className="h-5 w-5" />} value={profile?.streak_days ?? 0} label="Racha (días)" />
        <Stat icon={<BookCheck className="h-5 w-5" />} value={completedAdventures} label="Aventuras" />
        <Stat icon={<Trophy className="h-5 w-5" />} value={earnedCount} label="Insignias" />
      </div>

      {/* Nota general */}
      <div className="bg-adventure mb-6 flex flex-col items-center gap-4 rounded-3xl p-5 text-white sm:flex-row">
        <div className="flex h-24 w-24 shrink-0 flex-col items-center justify-center rounded-2xl bg-white/15">
          <span className="text-4xl font-extrabold leading-none">
            {formatNota(myRow?.general)}
          </span>
          <span className="mt-1 text-[11px] text-white/80">de 5.0</span>
        </div>
        <div className="flex-1 text-center sm:text-left">
          <p className="inline-flex items-center gap-1.5 text-sm font-medium text-white/85">
            <GraduationCap className="h-4 w-4" /> Mi nota general
          </p>
          <p className="text-xl font-bold">
            {myRow?.general == null
              ? "Aún no tienes notas. ¡Completa tu primera tarea!"
              : myRow.general >= 4.5
                ? "¡Desempeño superior! Eres un ejemplo."
                : myRow.general >= NOTA_APROBATORIA
                  ? "¡Vas muy bien! Sigue subiendo."
                  : "¡Tú puedes mejorar! Completa tus misiones pendientes."}
          </p>
          {myRow && (
            <p className="text-sm text-white/85">
              {myRow.finishedCount} de {myRow.assignedCount} tareas terminadas
              {myRow.position != null && ranked.length > 1 && (
                <> · Puesto {myRow.position} de {ranked.length} en {me?.grade}</>
              )}
            </p>
          )}
        </div>
        {myRow?.position != null && myRow.position <= 3 && (
          <span className="animate-trophy text-5xl" aria-hidden>
            {myRow.position === 1 ? "🥇" : myRow.position === 2 ? "🥈" : "🥉"}
          </span>
        )}
      </div>

      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        {/* Notas por tarea */}
        <section>
          <h2 className="mb-3 font-semibold">Mis notas por tarea</h2>
          {myTasks.length === 0 ? (
            <p className="text-muted rounded-2xl border border-dashed py-8 text-center text-sm">
              Todavía no tienes tareas asignadas.
            </p>
          ) : (
            <ul className="bg-card divide-y rounded-2xl border">
              {myTasks.map(({ task, result }) => (
                <li key={task.id}>
                  <Link
                    href={`/aventura/${task.id}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-background"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{task.title}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border">
                          <div
                            className={`h-full rounded-full ${result.finished ? "bg-success" : "bg-adventure"}`}
                            style={{ width: `${result.percent}%` }}
                          />
                        </div>
                        <span className="text-muted w-9 text-right text-xs">
                          {result.percent}%
                        </span>
                      </div>
                    </div>
                    <span className={`w-10 text-right text-lg font-bold ${notaTone(result.nota)}`}>
                      {formatNota(result.nota)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Ranking del curso */}
        <section>
          <h2 className="mb-3 inline-flex items-center gap-1.5 font-semibold">
            <Medal className="h-4 w-4 text-accent" />
            Ranking del curso {me?.grade ? `· ${me.grade}` : ""}
          </h2>
          {ranking.length === 0 ? (
            <p className="text-muted rounded-2xl border border-dashed py-8 text-center text-sm">
              El ranking aparecerá cuando haya notas en tu curso.
            </p>
          ) : (
            <div className="bg-card overflow-hidden rounded-2xl border">
              <table className="w-full text-sm">
                <thead className="text-muted bg-background text-xs">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">#</th>
                    <th className="px-3 py-2 text-left font-medium">Estudiante</th>
                    <th className="px-3 py-2 text-right font-medium">Tareas</th>
                    <th className="px-3 py-2 text-right font-medium">Nota</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {ranking.map((r) => {
                    const isMe = r.student.id === session!.userId;
                    return (
                      <tr
                        key={r.student.id}
                        className={isMe ? "bg-brand/10 font-semibold" : ""}
                      >
                        <td className="px-3 py-2">
                          {r.position == null
                            ? "—"
                            : r.position === 1
                              ? "🥇"
                              : r.position === 2
                                ? "🥈"
                                : r.position === 3
                                  ? "🥉"
                                  : r.position}
                        </td>
                        <td className="px-3 py-2">
                          {r.student.full_name ?? "Estudiante"}
                          {isMe && <span className="text-brand"> (tú)</span>}
                        </td>
                        <td className="text-muted px-3 py-2 text-right">
                          {r.finishedCount}/{r.assignedCount}
                        </td>
                        <td className={`px-3 py-2 text-right font-bold ${notaTone(r.general)}`}>
                          {formatNota(r.general)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <h2 className="mb-3 font-semibold">Insignias</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {badges.map((b) => (
          <BadgeChip
            key={b.id}
            name={b.name}
            description={b.description}
            icon={b.icon}
            earned={earnedIds.has(b.id)}
          />
        ))}
      </div>
    </div>
  );
}

function Stat({
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
      <span className="bg-adventure flex h-10 w-10 items-center justify-center rounded-xl text-white">
        {icon}
      </span>
      <span className="text-2xl font-bold">{value}</span>
      <span className="text-muted text-xs">{label}</span>
    </div>
  );
}
