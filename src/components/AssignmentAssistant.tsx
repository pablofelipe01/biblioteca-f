"use client";

import { useState, useRef, useEffect } from "react";
import type { MissionInput } from "@/app/(profesor)/tareas/actions";
import { Sparkles, Send, Loader2, Wand2, CheckCircle2 } from "lucide-react";

interface Turn {
  role: "user" | "assistant";
  content: string;
}

export interface AssignmentDraft {
  title?: string;
  chapter_label?: string;
  instructions?: string;
  grade?: string;
  school_cycle?: string;
  reading_experience?: string;
  excerpt_text?: string;
  missions?: MissionInput[];
}

export interface AssistantContext {
  title?: string;
  grade?: string;
  school_cycle?: string;
  reading_experience?: string;
}

export default function AssignmentAssistant({
  context,
  bookTitle,
  onApplyDraft,
}: {
  context: AssistantContext;
  bookTitle?: string;
  onApplyDraft: (draft: AssignmentDraft) => void;
}) {
  const [history, setHistory] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<AssignmentDraft | null>(null);
  const [applied, setApplied] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const seededFor = useRef<string | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, loading]);

  // Cuando el docente llega con un libro ya elegido (o escoge uno del catálogo),
  // precargamos su título en el cuadro del asistente para que pueda enviar de una
  // vez sin re-escribirlo. Solo mientras no haya empezado la conversación.
  useEffect(() => {
    const t = bookTitle?.trim();
    if (!t || history.length > 0 || seededFor.current === t) return;
    seededFor.current = t;
    setInput(t);
  }, [bookTitle, history.length]);

  async function send() {
    const msg = input.trim();
    if (!msg || loading) return;
    setInput("");
    const next = [...history, { role: "user" as const, content: msg }];
    setHistory(next);
    setLoading(true);
    setApplied(false);
    try {
      const res = await fetch("/api/ai/assignment-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ history, message: msg, context }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "No pude responder.");
      setHistory([...next, { role: "assistant", content: json.reply }]);
      if (json.draft) setDraft(json.draft as AssignmentDraft);
    } catch (e) {
      setHistory([
        ...next,
        {
          role: "assistant",
          content: e instanceof Error ? e.message : "Hubo un problema.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function apply() {
    if (!draft) return;
    onApplyDraft(draft);
    setApplied(true);
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-brand/30 bg-brand/5">
      <div className="bg-adventure flex items-center gap-2 px-4 py-3 text-white">
        <Sparkles className="h-5 w-5" />
        <div>
          <p className="font-semibold leading-tight">Crea tu tarea con ayuda de la IA</p>
          <p className="text-xs text-white/80">
            Escribe el título de un libro y te guío paso a paso.
          </p>
        </div>
      </div>

      <div className="max-h-80 space-y-3 overflow-auto p-4">
        {history.length === 0 && (
          <p className="text-muted text-sm">
            👋 ¡Hola! Dime el <strong>título del libro</strong> que quieres trabajar
            (o cuéntame el tema) y te diré de qué trata, para qué grados va bien, y
            armamos juntos la lectura con sus retos.
          </p>
        )}
        {history.map((t, i) => (
          <div
            key={i}
            className={`flex ${t.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <span
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
                t.role === "user" ? "bg-brand text-white" : "bg-card border"
              }`}
            >
              {t.content}
            </span>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <span className="bg-card inline-flex items-center gap-1 rounded-2xl border px-3 py-2 text-sm">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> pensando…
            </span>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {draft && (
        <div className="mx-4 mb-3 rounded-xl border border-brand/40 bg-card p-3">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-brand">
            <Wand2 className="h-4 w-4" /> Borrador propuesto
          </p>
          {draft.title && (
            <p className="mt-1 text-sm">
              <span className="text-muted">Título:</span> {draft.title}
            </p>
          )}
          <p className="text-muted text-xs">
            {draft.missions?.length ?? 0} misión(es)
            {draft.grade ? ` · grado ${draft.grade}` : ""}
          </p>
          <button
            type="button"
            onClick={apply}
            className="bg-adventure mt-2 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold text-white"
          >
            {applied ? (
              <>
                <CheckCircle2 className="h-4 w-4" /> Aplicado
              </>
            ) : (
              <>
                <Wand2 className="h-4 w-4" /> Aplicar al formulario
              </>
            )}
          </button>
          {applied && (
            <span className="text-muted ml-2 text-xs">
              Revisa y edita los campos abajo antes de publicar.
            </span>
          )}
        </div>
      )}

      <div className="flex gap-2 border-t border-brand/20 p-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Ej. “Cien años de soledad” o “un libro sobre el mar para 7º”…"
          className="flex-1 rounded-xl border bg-card px-3 py-2 text-sm outline-none focus:border-brand"
        />
        <button
          type="button"
          onClick={send}
          disabled={loading || !input.trim()}
          className="bg-adventure flex h-9 w-9 items-center justify-center rounded-xl text-white disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}
