"use client";

import { useRef, useState, useTransition } from "react";
import ImageGallery from "@/components/ImageGallery";
import { saveTeacherReview } from "@/app/(profesor)/tareas/actions";
import { formatNota, notaTone, toNota } from "@/lib/grades";
import type { Mission } from "@/lib/types";
import type { SubmissionRow } from "./page";
import { CheckCircle2, Loader2, MessageSquareText, Save } from "lucide-react";

const EMOJIS = ["👏", "🌟", "💪", "🎉", "👍", "📚", "💡", "🤔", "❤️", "😊", "🚀", "🏆"];

function responseText(mission: Mission, response: unknown): string {
  const resp = response as Record<string, unknown> | null;
  if (!resp || typeof resp !== "object") return String(response ?? "");
  if (typeof resp.selected_index === "number") {
    const options = (mission.data as { options?: string[] }).options ?? [];
    const i = resp.selected_index;
    const correct = (mission.data as { correct_index?: number }).correct_index;
    return `Opción ${i + 1}: ${options[i] ?? ""}${correct === i ? " ✓" : ""}`;
  }
  return typeof resp.text === "string" ? resp.text : "";
}

/** Una entrega con su nota (IA / docente) y el comentario del docente. */
export default function SubmissionReview({
  mission,
  submission,
}: {
  mission: Mission;
  submission: SubmissionRow;
}) {
  const [nota, setNota] = useState<string>(
    submission.teacher_score != null ? toNota(submission.teacher_score).toFixed(1) : "",
  );
  const [comment, setComment] = useState(submission.teacher_comment ?? "");
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const text = responseText(mission, submission.response);
  const aiNota = submission.ai_score != null ? toNota(submission.ai_score) : null;

  function insertEmoji(emoji: string) {
    const el = textRef.current;
    const pos = el?.selectionStart ?? comment.length;
    const next = comment.slice(0, pos) + emoji + comment.slice(el?.selectionEnd ?? pos);
    setComment(next);
    setSaved(false);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(pos + emoji.length, pos + emoji.length);
    });
  }

  function save() {
    setError(null);
    const raw = nota.trim().replace(",", ".");
    const n = raw ? parseFloat(raw) : null;
    if (n != null && (Number.isNaN(n) || n < 1 || n > 5)) {
      return setError("La nota va de 1.0 a 5.0.");
    }
    setSaved(false);
    start(async () => {
      try {
        await saveTeacherReview(submission.id, { nota: n, comment });
        setSaved(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo guardar.");
      }
    });
  }

  return (
    <div className="rounded-xl border bg-background p-3">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="font-semibold">{mission.title ?? `Misión ${mission.mission_number}`}</span>
        <span className="text-muted">
          {new Date(submission.created_at).toLocaleDateString("es")}
        </span>
      </div>

      {text && <p className="whitespace-pre-wrap text-sm">{text}</p>}
      {submission.images.length > 0 && (
        <div className="mt-2">
          <ImageGallery images={submission.images} size="sm" />
        </div>
      )}

      {submission.ai_feedback && (
        <p className="text-muted mt-2 rounded-lg bg-brand/5 p-2 text-xs">
          <span className="font-medium text-brand">IA:</span> {submission.ai_feedback}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
        <span className="text-muted">
          Nota IA: <span className={`font-semibold ${notaTone(aiNota)}`}>{formatNota(aiNota)}</span>
        </span>
        <span className="text-muted">+{submission.earned_points} pts</span>
        <label className="ml-auto flex items-center gap-1">
          Nota docente
          <input
            type="number"
            inputMode="decimal"
            min={1}
            max={5}
            step={0.1}
            value={nota}
            onChange={(e) => {
              setNota(e.target.value);
              setSaved(false);
            }}
            className="w-16 rounded-lg border bg-card px-2 py-1"
            placeholder="—"
          />
        </label>
      </div>

      <div className="mt-2">
        <label className="text-muted mb-1 flex items-center gap-1 text-xs font-medium">
          <MessageSquareText className="h-3.5 w-3.5" /> Comentario para el estudiante
        </label>
        <textarea
          ref={textRef}
          value={comment}
          onChange={(e) => {
            setComment(e.target.value);
            setSaved(false);
          }}
          rows={2}
          maxLength={1000}
          placeholder="¡Muy buen trabajo! …"
          className="w-full rounded-lg border bg-card px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
        <div className="mt-1 flex flex-wrap items-center gap-1">
          {EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => insertEmoji(e)}
              className="rounded-lg px-1.5 py-0.5 text-lg leading-none transition hover:scale-110 hover:bg-card"
              title={`Agregar ${e}`}
            >
              {e}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2">
            {error && <span className="text-xs text-danger">{error}</span>}
            {saved && !pending && (
              <span className="inline-flex items-center gap-1 text-xs text-success">
                <CheckCircle2 className="h-3.5 w-3.5" /> Guardado
              </span>
            )}
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className="bg-adventure inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            >
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Guardar revisión
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
