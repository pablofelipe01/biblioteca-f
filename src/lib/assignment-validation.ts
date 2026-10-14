// Reglas para publicar una tarea. Los borradores pueden guardarse incompletos;
// estas validaciones solo se exigen al publicar (cliente y servidor).

export const MIN_EXCERPT_CHARS = 50;

interface MissionLike {
  type: string;
  data: Record<string, unknown>;
}

/** Problema de una misión que impide publicarla, o null si está completa. */
export function missionProblem(m: MissionLike, index: number): string | null {
  const n = index + 1;
  const d = m.data ?? {};
  if (m.type === "quiz") {
    if (!String(d.question ?? "").trim()) return `La misión ${n} no tiene pregunta.`;
    const options = Array.isArray(d.options) ? d.options : [];
    if (options.length < 4 || options.some((o) => !String(o ?? "").trim())) {
      return `Completa las 4 opciones de la misión ${n}.`;
    }
    return null;
  }
  if (!String(d.prompt ?? "").trim()) return `La misión ${n} no tiene consigna.`;
  return null;
}

/** Primer problema que impide publicar la tarea, o null si está lista. */
export function publishProblem(input: {
  title: string | null | undefined;
  excerpt_text: string | null | undefined;
  missions: MissionLike[];
}): string | null {
  if (!input.title?.trim()) return "Ponle un título a la tarea.";
  if ((input.excerpt_text ?? "").trim().length < MIN_EXCERPT_CHARS) {
    return `Pega o sube un fragmento (mínimo ${MIN_EXCERPT_CHARS} caracteres).`;
  }
  if (input.missions.length === 0) {
    return "Agrega al menos una misión (genera con IA o manual).";
  }
  for (const [i, m] of input.missions.entries()) {
    const p = missionProblem(m, i);
    if (p) return p;
  }
  return null;
}

/** Si la misión permite adjuntar fotos en la respuesta (antes era siempre sí). */
export function allowsAnswerImages(data: unknown): boolean {
  return (data as { allow_images?: unknown } | null)?.allow_images !== false;
}
