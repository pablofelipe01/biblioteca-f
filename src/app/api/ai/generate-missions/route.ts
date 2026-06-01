import { NextResponse, type NextRequest } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { anthropic, AI_MODEL, parseJsonLoose, textFromMessage } from "@/lib/anthropic";
import { GENERATE_MISSIONS_SYSTEM } from "@/lib/prompts";
import type { MissionType } from "@/lib/types";

const MAX_EXCERPT = 14000; // recorte defensivo de tokens

interface GeneratedMission {
  mission_number: number;
  type: MissionType;
  title: string;
  points: number;
  data: Record<string, unknown>;
}

export async function POST(req: NextRequest) {
  const session = await getSessionProfile();
  if (!session?.profile) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  if (!["profesor", "admin"].includes(session.profile.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  let body: {
    excerpt_text?: string;
    school_cycle?: string;
    reading_experience?: string;
    num_missions?: number;
    types?: MissionType[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const excerpt = (body.excerpt_text ?? "").trim().slice(0, MAX_EXCERPT);
  if (excerpt.length < 50) {
    return NextResponse.json(
      { error: "El fragmento es demasiado corto para generar misiones." },
      { status: 400 },
    );
  }

  const numMissions = Math.min(Math.max(body.num_missions ?? 3, 1), 6);
  const types = body.types?.length ? body.types.join(", ") : "quiz, open, creative";

  const userMessage = `FRAGMENTO:
"""
${excerpt}
"""

Contexto:
- Ciclo escolar: ${body.school_cycle ?? "no especificado"}
- Experiencia lectora / edad: ${body.reading_experience ?? "no especificada"}
- Número de misiones a crear: ${numMissions}
- Tipos a incluir (mezcla): ${types}

Genera las misiones ahora.`;

  try {
    const message = await anthropic.messages.create({
      model: AI_MODEL,
      max_tokens: 2500,
      system: GENERATE_MISSIONS_SYSTEM,
      messages: [{ role: "user", content: userMessage }],
    });

    const raw = textFromMessage(message);
    const parsed = parseJsonLoose<{ missions?: GeneratedMission[] }>(raw);
    const missions = Array.isArray(parsed.missions) ? parsed.missions : [];

    if (missions.length === 0) {
      return NextResponse.json(
        { error: "La IA no devolvió misiones. Intenta de nuevo." },
        { status: 502 },
      );
    }

    // Normalización defensiva del contrato (§8.2)
    const clean = missions
      .filter((m) => ["quiz", "open", "creative"].includes(m.type))
      .map((m, i) => ({
        mission_number: m.mission_number ?? i + 1,
        type: m.type,
        title: String(m.title ?? `Misión ${i + 1}`),
        points:
          typeof m.points === "number"
            ? m.points
            : m.type === "creative"
              ? 20
              : m.type === "open"
                ? 15
                : 10,
        data: m.data ?? {},
      }));

    return NextResponse.json({ missions: clean });
  } catch (err) {
    console.error("generate-missions error:", err);
    return NextResponse.json(
      { error: "No se pudieron generar las misiones." },
      { status: 500 },
    );
  }
}
