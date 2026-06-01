import { NextResponse, type NextRequest } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { anthropic, AI_MODEL, parseJsonLoose, textFromMessage } from "@/lib/anthropic";
import { SUMMARIZE_SYSTEM } from "@/lib/prompts";

const MAX_EXCERPT = 14000;

export async function POST(req: NextRequest) {
  const session = await getSessionProfile();
  if (!session?.profile) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  if (!["profesor", "admin"].includes(session.profile.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  let body: { excerpt_text?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const excerpt = (body.excerpt_text ?? "").trim().slice(0, MAX_EXCERPT);
  if (excerpt.length < 50) {
    return NextResponse.json(
      { error: "El fragmento es demasiado corto." },
      { status: 400 },
    );
  }

  try {
    const message = await anthropic.messages.create({
      model: AI_MODEL,
      max_tokens: 700,
      system: SUMMARIZE_SYSTEM,
      messages: [{ role: "user", content: `FRAGMENTO:\n"""\n${excerpt}\n"""` }],
    });

    const parsed = parseJsonLoose<{
      summary?: string;
      themes?: string[];
      reading_level?: string;
      suggested_cycle?: string;
    }>(textFromMessage(message));

    return NextResponse.json({
      summary: parsed.summary ?? "",
      themes: Array.isArray(parsed.themes) ? parsed.themes : [],
      reading_level: parsed.reading_level ?? null,
      suggested_cycle: parsed.suggested_cycle ?? null,
    });
  } catch (err) {
    console.error("summarize error:", err);
    return NextResponse.json(
      { error: "No se pudo resumir el fragmento." },
      { status: 500 },
    );
  }
}
