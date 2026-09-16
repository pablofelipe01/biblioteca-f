// Notas: internamente cada misión guarda un puntaje 0–100 (ai_score / teacher_score).
// En pantalla se muestran en la escala colombiana 1.0–5.0.
// Módulo puro: se usa tanto en el servidor como en componentes de cliente.

export const NOTA_MIN = 1;
export const NOTA_MAX = 5;
/** Nota mínima aprobatoria (escala 1.0–5.0). */
export const NOTA_APROBATORIA = 3;

/** 0–100 → 1.0–5.0 (un decimal). */
export function toNota(score: number): number {
  const clamped = Math.min(Math.max(score, 0), 100);
  return Math.round((NOTA_MIN + (clamped * (NOTA_MAX - NOTA_MIN)) / 100) * 10) / 10;
}

/** 1.0–5.0 → 0–100. */
export function fromNota(nota: number): number {
  const clamped = Math.min(Math.max(nota, NOTA_MIN), NOTA_MAX);
  return Math.round(((clamped - NOTA_MIN) * 100) / (NOTA_MAX - NOTA_MIN));
}

export function formatNota(nota: number | null | undefined): string {
  return nota == null ? "—" : nota.toFixed(1);
}

/** Clases de color según desempeño (1.0–5.0). */
export function notaTone(nota: number | null | undefined): string {
  if (nota == null) return "text-muted";
  if (nota >= 4.5) return "text-success";
  if (nota >= NOTA_APROBATORIA) return "text-brand-2";
  return "text-danger";
}

/** Puntaje efectivo de una entrega: manda la nota del docente sobre la de IA. */
export function effectiveScore(s: {
  teacher_score: number | null;
  ai_score: number | null;
}): number | null {
  return s.teacher_score ?? s.ai_score ?? null;
}

export interface MissionScore {
  mission_id: string;
  score: number | null; // 0–100, null = sin entrega calificada
}

export interface TaskResult {
  answered: number;
  total: number;
  /** Porcentaje de misiones respondidas (0–100). */
  percent: number;
  finished: boolean;
  /** Nota 1.0–5.0; null si el estudiante no ha empezado (y la tarea no venció). */
  nota: number | null;
}

/**
 * Nota de una tarea para un estudiante = promedio de sus misiones, donde las
 * misiones sin responder cuentan como 0. Si no ha respondido nada, la nota solo
 * existe cuando la tarea ya venció (queda en 1.0).
 */
export function computeTaskResult(
  missionIds: string[],
  scoreByMission: Map<string, number | null>,
  opts: { dueAt?: string | null; now?: Date } = {},
): TaskResult {
  const total = missionIds.length;
  let answered = 0;
  let sum = 0;
  for (const id of missionIds) {
    if (!scoreByMission.has(id)) continue;
    answered += 1;
    sum += scoreByMission.get(id) ?? 0;
  }
  const percent = total > 0 ? Math.round((answered / total) * 100) : 0;
  const finished = total > 0 && answered >= total;
  const overdue =
    !!opts.dueAt && new Date(opts.dueAt) < (opts.now ?? new Date());
  const nota =
    total === 0 || (answered === 0 && !overdue) ? null : toNota(sum / total);
  return { answered, total, percent, finished, nota };
}

/** Promedio de notas (ignora null). */
export function averageNota(notas: (number | null)[]): number | null {
  const valid = notas.filter((n): n is number => n != null);
  if (valid.length === 0) return null;
  return Math.round((valid.reduce((a, b) => a + b, 0) / valid.length) * 10) / 10;
}
