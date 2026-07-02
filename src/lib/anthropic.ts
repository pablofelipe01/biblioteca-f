import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

/** Error específico: falta la API key de Anthropic en el servidor. */
export class MissingAnthropicKeyError extends Error {
  constructor() {
    super(
      "Falta configurar ANTHROPIC_API_KEY en el servidor. Agrégala en .env.local y reinicia el servidor de desarrollo.",
    );
    this.name = "MissingAnthropicKeyError";
  }
}

/**
 * Cliente Anthropic (SOLO servidor: la API key nunca llega al navegador).
 * Se construye de forma perezosa: si la key falta, lanzamos un error claro
 * DENTRO del handler (no al importar el módulo), para que la ruta pueda
 * responder con JSON en vez de una página de error HTML.
 */
let client: Anthropic | null = null;
export function getAnthropic(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new MissingAnthropicKeyError();
  if (!client) client = new Anthropic({ apiKey });
  return client;
}

/**
 * Respuesta de error uniforme para las rutas de IA. Convierte la falta de
 * API key en un mensaje entendible (503) y cualquier otro fallo en el mensaje
 * genérico de la ruta (500). Siempre devuelve JSON.
 */
export function aiErrorResponse(err: unknown, fallback: string): NextResponse {
  if (err instanceof MissingAnthropicKeyError) {
    return NextResponse.json({ error: err.message }, { status: 503 });
  }
  console.error(fallback, err);
  return NextResponse.json({ error: fallback }, { status: 500 });
}

export const AI_MODEL = "claude-sonnet-5";

/**
 * Extrae el primer objeto JSON válido de un texto que puede venir con fences
 * ```json ... ``` o texto extra alrededor. Limpia comas finales.
 * Lanza si no logra parsear.
 */
export function parseJsonLoose<T = unknown>(raw: string): T {
  let text = raw.trim();

  // Quitar fences de markdown
  text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");

  // Recortar al primer { ... último } (o [ ... ] para arrays)
  const firstObj = text.indexOf("{");
  const firstArr = text.indexOf("[");
  let start = -1;
  let end = -1;
  if (firstArr !== -1 && (firstObj === -1 || firstArr < firstObj)) {
    start = firstArr;
    end = text.lastIndexOf("]");
  } else if (firstObj !== -1) {
    start = firstObj;
    end = text.lastIndexOf("}");
  }
  if (start !== -1 && end !== -1 && end > start) {
    text = text.slice(start, end + 1);
  }

  // Quitar comas finales antes de } o ]
  text = text.replace(/,(\s*[}\]])/g, "$1");

  return JSON.parse(text) as T;
}

/**
 * Lee el texto plano de la respuesta de Claude (concatena bloques de texto).
 */
export function textFromMessage(message: Anthropic.Message): string {
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}
