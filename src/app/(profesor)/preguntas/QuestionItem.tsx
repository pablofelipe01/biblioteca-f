"use client";

import { useState, useTransition } from "react";
import { answerQuestion } from "@/app/(profesor)/tareas/actions";
import type { QuestionRow } from "./page";
import { Loader2, Send, CheckCircle2 } from "lucide-react";

export default function QuestionItem({ question }: { question: QuestionRow }) {
  const [response, setResponse] = useState(question.teacher_response ?? "");
  const [answered, setAnswered] = useState(!!question.teacher_response);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit() {
    if (!response.trim()) return;
    setError(null);
    start(async () => {
      try {
        await answerQuestion(question.id, response.trim());
        setAnswered(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo guardar.");
      }
    });
  }

  return (
    <li className="bg-card rounded-2xl border p-4">
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-medium">
          {question.student?.full_name ?? "Estudiante"}
          {question.student?.grade && (
            <span className="text-muted"> · {question.student.grade}</span>
          )}
          {question.assignment?.title && (
            <span className="text-muted"> · {question.assignment.title}</span>
          )}
        </span>
        <span className="text-muted">
          {new Date(question.created_at).toLocaleDateString("es")}
        </span>
      </div>

      <p className="text-sm font-medium">{question.question}</p>

      <div className="mt-3 space-y-2">
        <textarea
          value={response}
          onChange={(e) => {
            setResponse(e.target.value);
            setAnswered(false);
          }}
          rows={2}
          placeholder="Escribe tu respuesta…"
          className="w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
        <div className="flex items-center gap-2">
          <button
            onClick={submit}
            disabled={pending || !response.trim()}
            className="bg-adventure inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          >
            {pending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            {answered ? "Actualizar respuesta" : "Responder"}
          </button>
          {answered && !pending && (
            <span className="inline-flex items-center gap-1 text-xs text-success">
              <CheckCircle2 className="h-3.5 w-3.5" /> Respondida
            </span>
          )}
          {error && <span className="text-xs text-danger">{error}</span>}
        </div>
      </div>
    </li>
  );
}
