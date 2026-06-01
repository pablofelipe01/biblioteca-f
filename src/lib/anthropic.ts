import "server-only";
import Anthropic from "@anthropic-ai/sdk";

/** Cliente Anthropic. SOLO servidor: la API key nunca llega al navegador. */
export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

// El spec pedía "claude-sonnet-4-20250514", pero ese modelo está DEPRECADO
// (fin de vida 15-jun-2026). Usamos el Sonnet actual. Cambia aquí si lo necesitas.
export const AI_MODEL = "claude-sonnet-4-6";

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
