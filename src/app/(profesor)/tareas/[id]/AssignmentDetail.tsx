"use client";

import { useState, useTransition } from "react";
import MissionEditor from "@/components/MissionEditor";
import {
  setPublish,
  updateMission,
  adjustScore,
  type MissionInput,
} from "@/app/(profesor)/tareas/actions";
import type { Assignment, Mission } from "@/lib/types";
import type { SubmissionRow } from "./page";
import {
  Send,
  EyeOff,
  Save,
  Loader2,
  ChevronDown,
  ChevronUp,
  Inbox,
  CheckCircle2,
} from "lucide-react";

export default function AssignmentDetail({
  assignment,
  missions,
  submissions,
}: {
  assignment: Assignment;
  missions: Mission[];
  submissions: SubmissionRow[];
}) {
  const [published, setPublished] = useState(assignment.is_published);
  const [pubPending, startPub] = useTransition();
  const [showExcerpt, setShowExcerpt] = useState(false);

  function togglePublish() {
    const next = !published;
    setPublished(next);
    startPub(async () => {
      try {
        await setPublish(assignment.id, next);
      } catch {
        setPublished(!next); // revertir si falla
      }
    });
  }

  const subsByMission = new Map<string, SubmissionRow[]>();
  for (const s of submissions) {
    const arr = subsByMission.get(s.mission_id) ?? [];
    arr.push(s);
    subsByMission.set(s.mission_id, arr);
  }

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div className="bg-card flex flex-col gap-3 rounded-2xl border p-5 sm:flex-row sm:items-center">
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{assignment.title}</h1>
          <p className="text-muted text-sm">
            {assignment.chapter_label && <>{assignment.chapter_label} · </>}
            {assignment.grade ? `Curso ${assignment.grade}` : "Sin curso asignado"}
            {assignment.due_at && (
              <> · Entrega {new Date(assignment.due_at).toLocaleString("es")}</>
            )}
          </p>
        </div>
        <button
          onClick={togglePublish}
          disabled={pubPending}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:opacity-60 ${
            published
              ? "border bg-card hover:border-danger hover:text-danger"
              : "bg-adventure text-white"
          }`}
        >
          {pubPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : published ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          {published ? "Despublicar" : "Publicar"}
        </button>
      </div>

      {assignment.instructions && (
        <p className="bg-card rounded-2xl border p-4 text-sm">
          {assignment.instructions}
        </p>
      )}

      {/* Fragmento (colapsable) */}
      {assignment.excerpt_text && (
        <div className="bg-card rounded-2xl border">
          <button
            onClick={() => setShowExcerpt((v) => !v)}
            className="flex w-full items-center justify-between p-4 text-sm font-semibold"
          >
            Fragmento de lectura
            {showExcerpt ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
          {showExcerpt && (
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap border-t p-4 font-mono text-xs leading-relaxed">
              {assignment.excerpt_text}
            </pre>
          )}
        </div>
      )}

      {/* Misiones */}
      <section>
        <h2 className="mb-3 font-semibold">Misiones</h2>
        <div className="space-y-3">
          {missions.map((m, i) => (
            <EditableMission key={m.id} mission={m} index={i} />
          ))}
        </div>
      </section>

      {/* Entregas */}
      <section>
        <h2 className="mb-3 font-semibold">
          Entregas ({submissions.length})
        </h2>
        {submissions.length === 0 ? (
          <p className="text-muted flex flex-col items-center gap-2 rounded-2xl border border-dashed py-12 text-sm">
            <Inbox className="h-7 w-7" />
            Aún no hay entregas.
          </p>
        ) : (
          <div className="space-y-4">
            {missions.map((m) => {
              const subs = subsByMission.get(m.id) ?? [];
              if (subs.length === 0) return null;
              return (
                <div key={m.id} className="bg-card rounded-2xl border p-4">
                  <h3 className="mb-2 text-sm font-semibold">
                    {m.title ?? `Misión ${m.mission_number}`}
                  </h3>
                  <ul className="space-y-3">
                    {subs.map((s) => (
                      <SubmissionItem key={s.id} submission={s} />
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function EditableMission({ mission, index }: { mission: Mission; index: number }) {
  const [input, setInput] = useState<MissionInput>({
    mission_number: mission.mission_number,
    type: mission.type,
    title: mission.title ?? "",
    points: mission.points,
    data: mission.data as unknown as Record<string, unknown>,
  });
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  function save() {
    setSaved(false);
    start(async () => {
      await updateMission(mission.id, {
        title: input.title,
        points: input.points,
        data: input.data,
      });
      setSaved(true);
    });
  }

  return (
    <div>
      <MissionEditor mission={input} index={index} onChange={setInput} />
      <div className="mt-1 flex items-center gap-2">
        <button
          onClick={save}
          disabled={pending}
          className="bg-card inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium hover:border-brand disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          Guardar cambios
        </button>
        {saved && !pending && (
          <span className="inline-flex items-center gap-1 text-xs text-success">
            <CheckCircle2 className="h-3.5 w-3.5" /> Guardado
          </span>
        )}
      </div>
    </div>
  );
}

function SubmissionItem({ submission }: { submission: SubmissionRow }) {
  const [score, setScore] = useState<string>(
    submission.teacher_score?.toString() ?? "",
  );
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  const resp = submission.response as Record<string, unknown> | null;
  const responseText =
    resp && typeof resp === "object"
      ? ((resp.text as string) ??
        (typeof resp.selected_index === "number"
          ? `Opción ${(resp.selected_index as number) + 1}`
          : JSON.stringify(resp)))
      : String(submission.response ?? "");

  function save() {
    const n = parseFloat(score);
    if (Number.isNaN(n)) return;
    setSaved(false);
    start(async () => {
      await adjustScore(submission.id, n);
      setSaved(true);
    });
  }

  return (
    <li className="rounded-xl border bg-background p-3">
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-medium">
          {submission.student?.full_name ?? "Estudiante"}
          {submission.student?.grade && (
            <span className="text-muted"> · {submission.student.grade}</span>
          )}
        </span>
        <span className="text-muted">
          {new Date(submission.created_at).toLocaleDateString("es")}
        </span>
      </div>
      <p className="whitespace-pre-wrap text-sm">{responseText}</p>

      {submission.ai_feedback && (
        <p className="text-muted mt-2 rounded-lg bg-brand/5 p-2 text-xs">
          <span className="font-medium text-brand">IA:</span> {submission.ai_feedback}
        </p>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
        {submission.ai_score != null && (
          <span className="text-muted">IA: {submission.ai_score}/100</span>
        )}
        <span className="text-muted">+{submission.earned_points} pts</span>
        <label className="ml-auto flex items-center gap-1">
          Nota docente:
          <input
            type="number"
            min={0}
            max={100}
            value={score}
            onChange={(e) => setScore(e.target.value)}
            className="w-16 rounded-lg border bg-card px-2 py-1"
            placeholder="—"
          />
        </label>
        <button
          onClick={save}
          disabled={pending}
          className="bg-card inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 font-medium hover:border-brand disabled:opacity-50"
        >
          {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Ajustar"}
        </button>
        {saved && !pending && (
          <CheckCircle2 className="h-3.5 w-3.5 text-success" />
        )}
      </div>
    </li>
  );
}
