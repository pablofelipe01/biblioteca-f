import { NextResponse, type NextRequest } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { anthropic, AI_MODEL, textFromMessage } from "@/lib/anthropic";
import { TUTOR_CHAT_SYSTEM } from "@/lib/prompts";

const MAX_TURNS = 10;
const MAX_EXCERPT = 12000;

interface Turn {
  role: "user" | "assistant";
  content: string;
}

export async function POST(req: NextRequest) {
  const session = await getSessionProfile();
  if (!session?.profile) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  let body: { assignment_id?: string; history?: Turn[]; message?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const message = (body.message ?? "").trim();
  if (!message) {
    return NextResponse.json({ error: "Escribe un mensaje." }, { status: 400 });
  }
  if (!body.assignment_id) {
    return NextResponse.json({ error: "Falta assignment_id" }, { status: 400 });
  }

  // Cargamos el fragmento desde la BD (RLS gateado), no del cliente.
  const supabase = await createClient();
  const { data: assignment } = await supabase
    .from("assignments")
    .select("id, excerpt_text")
    .eq("id", body.assignment_id)
    .single();

  if (!assignment) {
    return NextResponse.json(
      { error: "Aventura no encontrada o no disponible." },
      { status: 404 },
    );
  }

  const excerpt = (assignment.excerpt_text ?? "").slice(0, MAX_EXCERPT);
  const system = `${TUTOR_CHAT_SYSTEM}\n\nFRAGMENTO:\n"""\n${excerpt}\n"""`;

  const history = Array.isArray(body.history) ? body.history.slice(-MAX_TURNS) : [];
  const messages = [
    ...history
      .filter((t) => t && (t.role === "user" || t.role === "assistant") && t.content)
      .map((t) => ({ role: t.role, content: String(t.content) })),
    { role: "user" as const, content: message },
  ];

  try {
    const reply = await anthropic.messages.create({
      model: AI_MODEL,
      max_tokens: 500,
      system,
      messages,
    });
    const text = textFromMessage(reply);

    // Registro (best-effort) de la conversación.
    await supabase.from("ai_conversations").insert({
      student_id: session.userId,
      assignment_id: assignment.id,
      question: message,
      ai_response: text,
    });

    return NextResponse.json({ reply: text });
  } catch (err) {
    console.error("tutor-chat error:", err);
    return NextResponse.json(
      { error: "El tutor no pudo responder ahora." },
      { status: 500 },
    );
  }
}
