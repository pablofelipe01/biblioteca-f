import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth";
import BadgeChip from "@/components/BadgeChip";
import type { Badge } from "@/lib/types";
import { Sparkles, Flame, Trophy, BookCheck } from "lucide-react";

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

  return (
    <div>
      <h1 className="mb-5 text-2xl font-bold">Mi progreso</h1>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat icon={<Sparkles className="h-5 w-5" />} value={profile?.total_points ?? 0} label="Puntos" />
        <Stat icon={<Flame className="h-5 w-5" />} value={profile?.streak_days ?? 0} label="Racha (días)" />
        <Stat icon={<BookCheck className="h-5 w-5" />} value={completedAdventures} label="Aventuras" />
        <Stat icon={<Trophy className="h-5 w-5" />} value={earnedCount} label="Insignias" />
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
