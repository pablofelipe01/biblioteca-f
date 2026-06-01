import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { MissionType } from "@/lib/types";

// Bonus al completar TODAS las misiones de una aventura (§9).
export const COMPLETION_BONUS = 50;

/** Puntos ganados, proporcionales al puntaje (§9). */
export function computeEarnedPoints(missionPoints: number, score: number): number {
  return Math.round((missionPoints * score) / 100);
}

/** Fecha (YYYY-MM-DD) en zona del servidor. */
function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Calcula la nueva racha de días consecutivos.
 * - mismo día: sin cambios
 * - día siguiente: +1
 * - hueco: reinicia a 1
 */
export function nextStreak(
  lastDate: string | null,
  currentStreak: number,
  today: string = todayStr(),
): number {
  if (!lastDate) return 1;
  if (lastDate === today) return Math.max(currentStreak, 1);
  const prev = new Date(today);
  prev.setUTCDate(prev.getUTCDate() - 1);
  const yesterday = prev.toISOString().slice(0, 10);
  if (lastDate === yesterday) return currentStreak + 1;
  return 1;
}

export interface RewardResult {
  earned_points: number;
  total_points: number;
  streak_days: number;
  new_badges: { code: string; name: string; icon: string | null }[];
  adventure_completed: boolean;
}

interface RecordParams {
  studentId: string;
  assignmentId: string;
  missionId: string;
  missionType: MissionType;
  missionPoints: number;
  response: unknown;
  score: number;
  feedback: string | null;
}

/**
 * Persiste la entrega y aplica recompensas (puntos, racha, insignias, bonus).
 * Usa el cliente admin (service key) porque debe escribir columnas protegidas
 * por RLS (profiles.total_points/streak) e insertar user_badges. La autorización
 * (que el alumno pueda acceder a la misión) se valida ANTES, en el endpoint.
 */
export async function recordGradedSubmission(
  params: RecordParams,
): Promise<RewardResult> {
  const supabase = createAdminClient();
  const today = todayStr();
  const earned = computeEarnedPoints(params.missionPoints, params.score);

  // ¿Ya existía entrega para esta (misión, alumno)?
  const { data: existing } = await supabase
    .from("submissions")
    .select("id, earned_points")
    .eq("student_id", params.studentId)
    .eq("mission_id", params.missionId)
    .maybeSingle();

  const wasNew = !existing;
  const oldEarned = existing?.earned_points ?? 0;

  if (existing) {
    await supabase
      .from("submissions")
      .update({
        response: params.response,
        ai_score: params.score,
        ai_feedback: params.feedback,
        earned_points: earned,
        status: "graded",
      })
      .eq("id", existing.id);
  } else {
    await supabase.from("submissions").insert({
      student_id: params.studentId,
      mission_id: params.missionId,
      response: params.response,
      ai_score: params.score,
      ai_feedback: params.feedback,
      earned_points: earned,
      status: "graded",
    });
  }

  // --- Calcular completitud de aventuras y conteos para insignias ---
  const { data: gradedSubs } = await supabase
    .from("submissions")
    .select("mission_id, ai_score, mission:missions!inner(assignment_id, type)")
    .eq("student_id", params.studentId)
    .eq("status", "graded");

  type SubRow = {
    mission_id: string;
    ai_score: number | null;
    mission: { assignment_id: string; type: string } | null;
  };
  const subs = (gradedSubs as unknown as SubRow[] | null) ?? [];

  const totalGraded = subs.length;
  const creativeGood = subs.filter(
    (s) => s.mission?.type === "creative" && (s.ai_score ?? 0) >= 80,
  ).length;

  // misiones distintas completadas por aventura
  const doneByAssignment = new Map<string, Set<string>>();
  for (const s of subs) {
    const aid = s.mission?.assignment_id;
    if (!aid) continue;
    const set = doneByAssignment.get(aid) ?? new Set<string>();
    set.add(s.mission_id);
    doneByAssignment.set(aid, set);
  }

  // total de misiones por aventura (solo de las aventuras que tocó)
  const assignmentIds = [...doneByAssignment.keys()];
  const totalByAssignment = new Map<string, number>();
  if (assignmentIds.length > 0) {
    const { data: allMissions } = await supabase
      .from("missions")
      .select("assignment_id")
      .in("assignment_id", assignmentIds);
    for (const m of (allMissions as { assignment_id: string }[] | null) ?? []) {
      totalByAssignment.set(
        m.assignment_id,
        (totalByAssignment.get(m.assignment_id) ?? 0) + 1,
      );
    }
  }

  function isComplete(aid: string): boolean {
    const total = totalByAssignment.get(aid) ?? 0;
    const done = doneByAssignment.get(aid)?.size ?? 0;
    return total > 0 && done >= total;
  }

  const completedCount = assignmentIds.filter(isComplete).length;
  const adventureCompleted = isComplete(params.assignmentId);
  // El bonus solo se da cuando ESTA entrega nueva completó la aventura.
  const justCompleted = wasNew && adventureCompleted;

  // --- Actualizar perfil (puntos + racha) ---
  const { data: profile } = await supabase
    .from("profiles")
    .select("total_points, streak_days, last_submission_date")
    .eq("id", params.studentId)
    .single();

  const prevPoints = profile?.total_points ?? 0;
  const prevStreak = profile?.streak_days ?? 0;
  const lastDate = profile?.last_submission_date ?? null;

  const pointsDelta = earned - oldEarned + (justCompleted ? COMPLETION_BONUS : 0);
  const newStreak = nextStreak(lastDate, prevStreak, today);
  const newTotal = prevPoints + pointsDelta;

  await supabase
    .from("profiles")
    .update({
      total_points: newTotal,
      streak_days: newStreak,
      last_submission_date: today,
    })
    .eq("id", params.studentId);

  // --- Otorgar insignias ---
  const toAward: string[] = [];
  if (totalGraded >= 1) toAward.push("primer_paso");
  if (creativeGood >= 3) toAward.push("creativo");
  if (newStreak >= 7) toAward.push("racha_7");
  if (completedCount >= 1) toAward.push("aventurero");
  if (completedCount >= 10) toAward.push("maraton_lector");

  const newBadges: RewardResult["new_badges"] = [];
  if (toAward.length > 0) {
    const { data: badgeRows } = await supabase
      .from("badges")
      .select("id, code, name, icon")
      .in("code", toAward);

    for (const b of (badgeRows as
      | { id: string; code: string; name: string; icon: string | null }[]
      | null) ?? []) {
      // Insertar si no la tenía (unique student_id+badge_id).
      const { data: existingBadge } = await supabase
        .from("user_badges")
        .select("id")
        .eq("student_id", params.studentId)
        .eq("badge_id", b.id)
        .maybeSingle();
      if (!existingBadge) {
        const { error } = await supabase
          .from("user_badges")
          .insert({ student_id: params.studentId, badge_id: b.id });
        if (!error) newBadges.push({ code: b.code, name: b.name, icon: b.icon });
      }
    }
  }

  return {
    earned_points: earned + (justCompleted ? COMPLETION_BONUS : 0),
    total_points: newTotal,
    streak_days: newStreak,
    new_badges: newBadges,
    adventure_completed: adventureCompleted,
  };
}
