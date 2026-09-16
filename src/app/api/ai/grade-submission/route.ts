import { NextResponse, type NextRequest } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  getAnthropic,
  aiErrorResponse,
  AI_MODEL,
  parseJsonLoose,
  textFromMessage,
} from "@/lib/anthropic";
import { GRADE_SUBMISSION_SYSTEM } from "@/lib/prompts";
import { recordGradedSubmission } from "@/lib/gamification";
import { createAdminClient } from "@/lib/supabase/admin";
import { IMAGE_BUCKET, MAX_IMAGES, isOwnAnswerPath } from "@/lib/images";
import type { MissionType } from "@/lib/types";
import type Anthropic from "@anthropic-ai/sdk";

type ImageMediaType = "image/jpeg" | "image/png" | "image/webp" | "image/gif";
const IMAGE_TYPES: ImageMediaType[] = ["image/jpeg", "image/png", "image/webp", "image/gif"];

/** Descarga las imágenes de la respuesta (service key) como bloques para Claude. */
async function loadImageBlocks(paths: string[]): Promise<Anthropic.ImageBlockParam[]> {
  if (paths.length === 0) return [];
  const admin = createAdminClient();
  const blocks: Anthropic.ImageBlockParam[] = [];
  for (const path of paths) {
    const { data } = await admin.storage.from(IMAGE_BUCKET).download(path);
    if (!data) continue;
    const ext = path.split(".").pop()?.toLowerCase();
    const fromExt: ImageMediaType =
      ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : ext === "gif" ? "image/gif" : "image/jpeg";
    const mediaType = IMAGE_TYPES.includes(data.type as ImageMediaType)
      ? (data.type as ImageMediaType)
      : fromExt;
    const base64 = Buffer.from(await data.arrayBuffer()).toString("base64");
    blocks.push({ type: "image", source: { type: "base64", media_type: mediaType, data: base64 } });
  }
  return blocks;
}

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
      "id, type, data, points, assignment_id, assignment:assignments!inner(resource:resources(school_cycle))",
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
  const rawResponse = body.response ?? {};
  let response: Record<string, unknown> = rawResponse;
  const schoolCycle =
    (
      mission.assignment as unknown as {
        resource: { school_cycle: string | null } | null;
      } | null
    )?.resource?.school_cycle ?? null;

  let score = 0;
  let feedback = "";

  try {
    if (type === "quiz") {
      // Corrección por código (sin IA).
      const selected = Number(rawResponse.selected_index);
      const correct = Number(data.correct_index);
      if (Number.isNaN(selected)) {
        return NextResponse.json(
          { error: "Selecciona una opción." },
          { status: 400 },
        );
      }
      response = { selected_index: selected };
      score = selected === correct ? 100 : 0;
      feedback =
        (data.explanation as string) ??
        (score === 100 ? "¡Correcto!" : "Esa no era. Repasa el fragmento.");
    } else {
      // open / creative -> evalúa Claude (texto y/o imágenes).
      const studentText = String(rawResponse.text ?? "").trim();
      const orgId = session.profile.org_id ?? "";
      const images = (Array.isArray(rawResponse.images) ? rawResponse.images : [])
        .filter((p): p is string => typeof p === "string")
        .filter((p) => !!orgId && isOwnAnswerPath(p, orgId, session.userId))
        .slice(0, MAX_IMAGES);
      if (studentText.length < 1 && images.length === 0) {
        return NextResponse.json(
          { error: "Escribe tu respuesta o sube una imagen antes de enviar." },
          { status: 400 },
        );
      }
      response = { text: studentText, images };
      const consigna = (data.prompt as string) ?? "";
      const rubric =
        (data.rubric as string) ??
        (type === "creative"
          ? `Reto creativo. Mínimo ${data.min_words ?? 40} palabras. Valora la creatividad y la conexión con la lectura.`
          : "Valora la comprensión e interpretación.");

      const imageBlocks = await loadImageBlocks(images);
      const imageNote =
        imageBlocks.length > 0
          ? `\n\nEl estudiante adjuntó ${imageBlocks.length} imagen(es) (a continuación) que FORMAN PARTE de su respuesta: pueden ser dibujos, fotos de su cuaderno o evidencias. Evalúalas junto con el texto.`
          : "";
      const userMessage = `CONSIGNA:\n${consigna}\n\nRÚBRICA:\n${rubric}\n\nCICLO ESCOLAR: ${schoolCycle ?? "no especificado"}\n\nRESPUESTA DEL ESTUDIANTE:\n"""\n${studentText || "(sin texto, solo imágenes)"}\n"""${imageNote}`;

      const message = await getAnthropic().messages.create({
        model: AI_MODEL,
        max_tokens: 500,
        thinking: { type: "disabled" },
        system: GRADE_SUBMISSION_SYSTEM,
        messages: [
          {
            role: "user",
            content: [{ type: "text", text: userMessage }, ...imageBlocks],
          },
        ],
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
    return aiErrorResponse(err, "No se pudo calificar la respuesta.");
  }
}
