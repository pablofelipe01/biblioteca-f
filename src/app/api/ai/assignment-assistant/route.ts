import { NextResponse, type NextRequest } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { anthropic, AI_MODEL, parseJsonLoose, textFromMessage } from "@/lib/anthropic";
import { ASSIGNMENT_ASSISTANT_SYSTEM } from "@/lib/prompts";
import type { MissionType } from "@/lib/types";

const MAX_TURNS = 12;

interface Turn {
  role: "user" | "assistant";
  content: string;
}

interface DraftMission {
  mission_number: number;
  type: MissionType;
  title: string;
  points: number;
  data: Record<string, unknown>;
}

interface DraftPayload {
  title?: string;
  chapter_label?: string;
  instructions?: string;
  grade?: string;
  school_cycle?: string;
  reading_experience?: string;
  excerpt_text?: string;
  missions?: DraftMission[];
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
    history?: Turn[];
    message?: string;
    context?: {
      title?: string;
      grade?: string;
      school_cycle?: string;
      reading_experience?: string;
    };
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const message = (body.message ?? "").trim();
  if (!message) {
    return NextResponse.json({ error: "Escribe un mensaje." }, { status: 400 });
  }

  // Contexto del catálogo: buscamos el libro por el título (o por el mensaje).
  const supabase = await createClient();
  const queryTitle = (body.context?.title || message)
    .replace(/[,()%*]/g, " ")
    .trim()
    .slice(0, 80);
  let catalogContext = "";
  if (queryTitle.length >= 3) {
    const { data: matches } = await supabase
      .from("resources")
      .select("title, author, synopsis, genre, school_cycle, reading_experience")
      .ilike("title", `%${queryTitle}%`)
      .eq("is_active", true)
      .limit(3);
    if (matches && matches.length > 0) {
      catalogContext =
        "\n\nCONTEXTO DEL CATÁLOGO (fichas curadas; úsalas si coinciden con el libro):\n" +
        matches
          .map(
            (m) =>
              `- "${m.title}"${m.author ? ` de ${m.author}` : ""} · Género: ${m.genre ?? "—"} · Ciclo: ${m.school_cycle ?? "—"} · Experiencia: ${m.reading_experience ?? "—"}\n  Reseña: ${m.synopsis ?? "(sin reseña)"}`,
          )
          .join("\n");
    }
  }

  // Cursos reales de la institución (para que "grade" sea un código válido).
  let gradesLine = "";
  if (session.profile.org_id) {
    const { data: gradeRows } = await supabase
      .from("profiles")
      .select("grade")
      .eq("org_id", session.profile.org_id)
      .eq("role", "alumno")
      .not("grade", "is", null);
    const grades = [
      ...new Set(
        (gradeRows as { grade: string | null }[] | null)
          ?.map((r) => r.grade)
          .filter((g): g is string => !!g) ?? [],
      ),
    ].sort();
    if (grades.length > 0) {
      gradesLine = `\n\nCURSOS DISPONIBLES EN LA INSTITUCIÓN (usa EXACTAMENTE uno de estos códigos para "grade"): ${grades.join(", ")}.`;
    }
  }

  const ctx = body.context;
  const contextLine =
    ctx && (ctx.grade || ctx.school_cycle || ctx.reading_experience)
      ? `\n\nDATOS YA ELEGIDOS POR EL DOCENTE (no los vuelvas a preguntar): grado=${ctx.grade || "—"}, ciclo=${ctx.school_cycle || "—"}, experiencia=${ctx.reading_experience || "—"}.`
      : "";

  const system =
    ASSIGNMENT_ASSISTANT_SYSTEM + catalogContext + gradesLine + contextLine;

  const history = Array.isArray(body.history) ? body.history.slice(-MAX_TURNS) : [];
  const messages = [
    ...history
      .filter((t) => t && (t.role === "user" || t.role === "assistant") && t.content)
      .map((t) => ({ role: t.role, content: String(t.content) })),
    { role: "user" as const, content: message },
  ];

  try {
    const completion = await anthropic.messages.create({
      model: AI_MODEL,
      max_tokens: 2000,
      system,
      messages,
    });

    const raw = textFromMessage(completion);

    // Extraer el bloque <<DRAFT>> ... <<END>> si existe.
    let reply = raw;
    let draft: DraftPayload | null = null;

    const start = raw.indexOf("<<DRAFT>>");
    if (start !== -1) {
      reply = raw.slice(0, start).trim();
      const endIdx = raw.indexOf("<<END>>", start);
      const jsonPart = raw.slice(
        start + "<<DRAFT>>".length,
        endIdx === -1 ? undefined : endIdx,
      );
      try {
        const parsed = parseJsonLoose<DraftPayload>(jsonPart);
        const missions = Array.isArray(parsed?.missions)
          ? parsed.missions
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
              }))
          : [];
        draft = { ...parsed, missions };
      } catch (e) {
        console.error("assistant draft parse error:", e);
      }
    }

    if (!reply) {
      reply = draft
        ? "Te preparé un borrador. Revísalo y aplícalo al formulario."
        : "¿Me cuentas un poco más?";
    }

    return NextResponse.json({ reply, draft });
  } catch (err) {
    console.error("assignment-assistant error:", err);
    return NextResponse.json(
      { error: "El asistente no pudo responder ahora." },
      { status: 500 },
    );
  }
}
