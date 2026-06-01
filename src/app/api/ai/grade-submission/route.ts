import { NextResponse, type NextRequest } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { anthropic, AI_MODEL, parseJsonLoose, textFromMessage } from "@/lib/anthropic";
import { GRADE_SUBMISSION_SYSTEM } from "@/lib/prompts";
import { recordGradedSubmission } from "@/lib/gamification";
import type { MissionType } from "@/lib/types";

export async function POST(req: NextRequest) {
  const session = await getSessionProfile();
  if (!session?.profile) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  let body: { mission_id?: string; response?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (!body.mission_id) {
    return NextResponse.json({ error: "Falta mission_id" }, { status: 400 });
  }

  // Cargar misión + aventura con el cliente de sesión: RLS garantiza que el
  // alumno solo accede a misiones de aventuras publicadas de su grado/org.
  const supabase = await createClient();
  const { data: mission } = await supabase
    .from("missions")
    .select(
      "id, type, data, points, assignment_id, assignment:assignments!inner(school_cycle)",
    )
    .eq("id", body.mission_id)
    .single();

  if (!mission) {
    return NextResponse.json(
      { error: "Misión no encontrada o no disponible." },
      { status: 404 },
    );
  }

  const type = mission.type as MissionType;
  const data = (mission.data ?? {}) as Record<string, unknown>;
  const response = body.response ?? {};
  const schoolCycle =
    (mission.assignment as unknown as { school_cycle: string | null } | null)
      ?.school_cycle ?? null;

  let score = 0;
  let feedback = "";

  try {
    if (type === "quiz") {
      // Corrección por código (sin IA).
      const selected = Number(response.selected_index);
      const correct = Number(data.correct_index);
      if (Number.isNaN(selected)) {
        return NextResponse.json(
          { error: "Selecciona una opción." },
          { status: 400 },
        );
      }
      score = selected === correct ? 100 : 0;
      feedback =
        (data.explanation as string) ??
        (score === 100 ? "¡Correcto!" : "Esa no era. Repasa el fragmento.");
    } else {
      // open / creative -> evalúa Claude.
      const studentText = String(response.text ?? "").trim();
      if (studentText.length < 1) {
        return NextResponse.json(
          { error: "Escribe tu respuesta antes de enviar." },
          { status: 400 },
        );
      }
      const consigna = (data.prompt as string) ?? "";
      const rubric =
        (data.rubric as string) ??
        (type === "creative"
          ? `Reto creativo. Mínimo ${data.min_words ?? 40} palabras. Valora la creatividad y la conexión con la lectura.`
          : "Valora la comprensión e interpretación.");

      const userMessage = `CONSIGNA:\n${consigna}\n\nRÚBRICA:\n${rubric}\n\nCICLO ESCOLAR: ${schoolCycle ?? "no especificado"}\n\nRESPUESTA DEL ESTUDIANTE:\n"""\n${studentText}\n"""`;

      const message = await anthropic.messages.create({
        model: AI_MODEL,
        max_tokens: 500,
        system: GRADE_SUBMISSION_SYSTEM,
        messages: [{ role: "user", content: userMessage }],
      });

      const parsed = parseJsonLoose<{ score?: number; feedback?: string }>(
        textFromMessage(message),
      );
      score = Math.min(Math.max(Math.round(Number(parsed.score) || 0), 0), 100);
      feedback = parsed.feedback ?? "¡Buen intento! Sigue así.";
    }

    const reward = await recordGradedSubmission({
      studentId: session.userId,
      assignmentId: mission.assignment_id,
      missionId: mission.id,
      missionType: type,
      missionPoints: mission.points,
      response,
      score,
      feedback,
    });

    return NextResponse.json({ score, feedback, ...reward });
  } catch (err) {
    console.error("grade-submission error:", err);
    return NextResponse.json(
      { error: "No se pudo calificar la respuesta." },
      { status: 500 },
    );
  }
}
