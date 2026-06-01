"use client";

import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Loader2, Sparkles } from "lucide-react";

interface Turn {
  role: "user" | "assistant";
  content: string;
}

export default function TutorChat({ assignmentId }: { assignmentId: string }) {
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, loading]);

  async function send() {
    const msg = input.trim();
    if (!msg || loading) return;
    setInput("");
    const newHistory = [...history, { role: "user" as const, content: msg }];
    setHistory(newHistory);
    setLoading(true);
    try {
      const res = await fetch("/api/ai/tutor-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignment_id: assignmentId,
          history: history.slice(-10),
          message: msg,
        }),
      });
      const json = await res.json();
      const reply = res.ok
        ? json.reply
        : (json.error ?? "No pude responder ahora.");
      setHistory([...newHistory, { role: "assistant", content: reply }]);
    } catch {
      setHistory([
        ...newHistory,
        { role: "assistant", content: "Hubo un problema de conexión." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className="bg-adventure fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg transition hover:scale-105"
        title="Tutor de lectura"
        aria-label="Abrir tutor de lectura"
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>

      {open && (
        <div className="bg-card fixed bottom-24 right-5 z-40 flex h-[28rem] w-[min(22rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border shadow-2xl">
          <div className="bg-adventure flex items-center gap-2 p-3 text-white">
            <Sparkles className="h-4 w-4" />
            <span className="font-semibold">Tutor de lectura</span>
          </div>

          <div className="flex-1 space-y-3 overflow-auto p-3">
            {history.length === 0 && (
              <p className="text-muted text-sm">
                ¡Hola! Soy tu tutor. Pregúntame por palabras difíciles o ideas del
                fragmento. (No te daré las respuestas de las misiones 😉)
              </p>
            )}
            {history.map((t, i) => (
              <div
                key={i}
                className={`flex ${t.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <span
                  className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
                    t.role === "user"
                      ? "bg-brand text-white"
                      : "bg-background"
                  }`}
                >
                  {t.content}
                </span>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <span className="bg-background inline-flex items-center gap-1 rounded-2xl px-3 py-2 text-sm">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> pensando…
                </span>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <div className="flex gap-2 border-t p-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Escribe tu duda…"
              className="flex-1 rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:border-brand"
            />
            <button
              onClick={send}
              disabled={loading || !input.trim()}
              className="bg-adventure flex h-9 w-9 items-center justify-center rounded-xl text-white disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
