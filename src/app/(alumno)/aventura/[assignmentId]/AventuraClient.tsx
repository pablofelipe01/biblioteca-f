"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import TutorChat from "./TutorChat";
import { askTeacher } from "@/app/(alumno)/actions";
import type { StudentMission, StudentQuestion } from "./page";
import type { AccessLink } from "@/lib/types";
import {
  Lock,
  CheckCircle2,
  ExternalLink,
  HelpCircle,
  PenLine,
  Wand2,
  Loader2,
  Sparkles,
  Send,
  MessageCircleQuestion,
  PartyPopper,
} from "lucide-react";

type Mission = StudentMission;

interface GradeResult {
  score: number;
  feedback: string;
  earned_points: number;
  new_badges: { code: string; name: string; icon: string | null }[];
  adventure_completed: boolean;
}

const TYPE_ICON: Record<Mission["type"], React.ReactNode> = {
  quiz: <HelpCircle className="h-4 w-4" />,
  open: <PenLine className="h-4 w-4" />,
  creative: <Wand2 className="h-4 w-4" />,
};

export default function AventuraClient({
  assignmentId,
  title,
  chapterLabel,
  instructions,
  excerpt,
  accessLinks,
  missions: initial,
  questions,
}: {
  assignmentId: string;
  title: string;
  chapterLabel: string | null;
  instructions: string | null;
  excerpt: string;
  accessLinks: AccessLink[];
  missions: Mission[];
  questions: StudentQuestion[];
}) {
  const router = useRouter();
  const [missions, setMissions] = useState<Mission[]>(initial);
  const [award, setAward] = useState<
    { code: string; name: string; icon: string | null }[] | null
  >(null);
  const [celebrate, setCelebrate] = useState(false);

  const completedCount = missions.filter((m) => m.done).length;

  function onGraded(missionId: string, result: GradeResult) {
    setMissions((prev) =>
      prev.map((m) =>
        m.id === missionId
          ? {
              ...m,
              done: true,
              ai_feedback: result.feedback,
              ai_score: result.score,
              earned_points: result.earned_points,
            }
          : m,
      ),
    );
    if (result.new_badges.length > 0) setAward(result.new_badges);
    if (result.adventure_completed && !missions.find((m) => m.id === missionId)?.done) {
      setCelebrate(true);
    }
    router.refresh(); // actualiza puntos en la cabecera
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
      {/* Panel de lectura */}
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          {chapterLabel && <p className="text-muted text-sm">{chapterLabel}</p>}
        </div>

        {instructions && (
          <p className="bg-card rounded-2xl border p-4 text-sm">{instructions}</p>
        )}

        {accessLinks.length > 0 && (
          <div className="bg-card rounded-2xl border p-4">
            <p className="mb-2 text-sm font-semibold">Leer la obra completa</p>
            <ul className="space-y-1">
              {accessLinks.map((l, i) => (
                <li key={i}>
                  <a
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm font-medium text-brand-2 hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    {l.label || l.url}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="bg-card rounded-2xl border">
          <p className="border-b p-4 text-sm font-semibold">Fragmento</p>
          <div className="max-h-[60vh] overflow-auto p-4">
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{excerpt}</p>
          </div>
        </div>

        <AskTeacher assignmentId={assignmentId} questions={questions} />
      </div>

      {/* Mapa de misiones */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">El mapa de la aventura</h2>
          <span className="text-muted text-sm">
            {completedCount}/{missions.length} misiones
          </span>
        </div>

        <ol className="space-y-3">
          {missions.map((m, i) => {
            const unlocked = i === 0 || missions[i - 1].done;
            return (
              <li key={m.id} className="relative">
                {i < missions.length - 1 && (
                  <span className="absolute left-4 top-10 h-full w-0.5 bg-border" />
                )}
                <MissionStep
                  mission={m}
                  index={i}
                  unlocked={unlocked}
                  onGraded={onGraded}
                />
              </li>
            );
          })}
        </ol>
      </div>

      <TutorChat assignmentId={assignmentId} />

      {award && (
        <Overlay onClose={() => setAward(null)}>
          <div className="text-center">
            <p className="text-sm font-semibold text-brand">¡Nueva insignia!</p>
            <div className="my-4 flex justify-center gap-4">
              {award.map((b) => (
                <div key={b.code} className="animate-pop-in">
                  <div className="text-6xl">{b.icon ?? "🏅"}</div>
                  <p className="mt-1 font-bold">{b.name}</p>
                </div>
              ))}
            </div>
            <button
              onClick={() => setAward(null)}
              className="bg-adventure rounded-xl px-4 py-2 font-semibold text-white"
            >
              ¡Genial!
            </button>
          </div>
        </Overlay>
      )}

      {celebrate && (
        <Overlay onClose={() => setCelebrate(false)}>
          <div className="animate-pop-in text-center">
            <PartyPopper className="mx-auto h-16 w-16 text-accent" />
            <h3 className="mt-3 text-xl font-bold">¡Aventura completada!</h3>
            <p className="text-muted mt-1 text-sm">
              Terminaste todas las misiones. ¡Ganaste puntos extra!
            </p>
            <button
              onClick={() => setCelebrate(false)}
              className="bg-adventure mt-4 rounded-xl px-4 py-2 font-semibold text-white"
            >
              Seguir
            </button>
          </div>
        </Overlay>
      )}
    </div>
  );
}

function MissionStep({
  mission,
  index,
  unlocked,
  onGraded,
}: {
  mission: Mission;
  index: number;
  unlocked: boolean;
  onGraded: (id: string, result: GradeResult) => void;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const d = mission.data;
  const options = (d.options as string[]) ?? [];
  const minWords = (d.min_words as number) ?? 0;

  async function submit() {
    setError(null);
    let response: Record<string, unknown>;
    if (mission.type === "quiz") {
      if (selected === null) return setError("Elige una opción.");
      response = { selected_index: selected };
    } else {
      if (text.trim().length < 1) return setError("Escribe tu respuesta.");
      response = { text: text.trim() };
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/ai/grade-submission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mission_id: mission.id, response }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "No se pudo calificar.");
      onGraded(mission.id, json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al enviar.");
    } finally {
      setSubmitting(false);
    }
  }

  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;

  return (
    <div
      className={`bg-card rounded-2xl border p-4 ${
        !unlocked ? "opacity-60" : ""
      } ${mission.done ? "border-success/40" : ""}`}
    >
      <div className="flex items-center gap-3">
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
            mission.done
              ? "bg-success text-white"
              : unlocked
                ? "bg-adventure text-white"
                : "bg-border text-muted"
          }`}
        >
          {mission.done ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : !unlocked ? (
            <Lock className="h-4 w-4" />
          ) : (
            index + 1
          )}
        </span>
        <div className="flex-1">
          <p className="font-semibold">{mission.title ?? `Misión ${index + 1}`}</p>
          <p className="text-muted flex items-center gap-1 text-xs">
            {TYPE_ICON[mission.type]}
            {mission.type === "quiz"
              ? "Quiz"
              : mission.type === "open"
                ? "Pregunta abierta"
                : "Reto creativo"}{" "}
            · {mission.points} pts
          </p>
        </div>
      </div>

      {!unlocked && (
        <p className="text-muted mt-3 text-xs">
          Completa la misión anterior para desbloquear esta.
        </p>
      )}

      {unlocked && mission.done && (
        <div className="mt-3 rounded-xl bg-green-50 p-3 text-sm">
          <p className="inline-flex items-center gap-1 font-medium text-success">
            <Sparkles className="h-3.5 w-3.5" /> +{mission.earned_points} puntos
          </p>
          {mission.ai_feedback && (
            <p className="mt-1 text-foreground/80">{mission.ai_feedback}</p>
          )}
        </div>
      )}

      {unlocked && !mission.done && (
        <div className="mt-3 space-y-3">
          {(d.question as string) && (
            <p className="text-sm font-medium">{d.question as string}</p>
          )}

          {mission.type === "quiz" ? (
            <div className="space-y-1.5">
              {options.map((opt, i) => (
                <label
                  key={i}
                  className={`flex cursor-pointer items-center gap-2 rounded-xl border p-2.5 text-sm transition ${
                    selected === i ? "border-brand bg-brand/5" : "hover:border-brand"
                  }`}
                >
                  <input
                    type="radio"
                    name={`q-${mission.id}`}
                    checked={selected === i}
                    onChange={() => setSelected(i)}
                    className="accent-brand"
                  />
                  {opt}
                </label>
              ))}
            </div>
          ) : (
            <>
              {(d.prompt as string) && (
                <p className="text-sm">{d.prompt as string}</p>
              )}
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={4}
                placeholder="Escribe tu respuesta…"
                className="w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
              {mission.type === "creative" && minWords > 0 && (
                <p
                  className={`text-xs ${
                    wordCount >= minWords ? "text-success" : "text-muted"
                  }`}
                >
                  {wordCount}/{minWords} palabras
                </p>
              )}
            </>
          )}

          {error && <p className="text-xs text-danger">{error}</p>}

          <button
            onClick={submit}
            disabled={submitting}
            className="bg-adventure inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Enviar respuesta
          </button>
        </div>
      )}
    </div>
  );
}

function AskTeacher({
  assignmentId,
  questions,
}: {
  assignmentId: string;
  questions: StudentQuestion[];
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();

  function submit() {
    if (!q.trim()) return;
    start(async () => {
      await askTeacher(assignmentId, q);
      setQ("");
      setSent(true);
      router.refresh(); // trae la nueva pregunta a la lista
    });
  }

  return (
    <div className="bg-card rounded-2xl border p-4">
      <p className="mb-2 inline-flex items-center gap-1.5 text-sm font-semibold">
        <MessageCircleQuestion className="h-4 w-4 text-brand" />
        Pregúntale a tu profe
      </p>

      {questions.length > 0 && (
        <ul className="mb-3 space-y-2">
          {questions.map((item) => (
            <li
              key={item.id}
              className="bg-background rounded-xl border p-3 text-sm"
            >
              <p className="font-medium">{item.question}</p>
              {item.teacher_response ? (
                <p className="mt-1.5 rounded-lg bg-brand/5 p-2 leading-relaxed text-foreground/80">
                  <span className="font-semibold text-brand">Profe: </span>
                  {item.teacher_response}
                </p>
              ) : (
                <p className="text-muted mt-1 text-xs italic">
                  Aún sin responder…
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      <textarea
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setSent(false);
        }}
        rows={2}
        placeholder="¿Tienes una duda para tu profesor?"
        className="w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
      />
      <div className="mt-2 flex items-center gap-2">
        <button
          onClick={submit}
          disabled={pending || !q.trim()}
          className="bg-card inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium hover:border-brand disabled:opacity-50"
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          Enviar pregunta
        </button>
        {sent && !pending && (
          <span className="text-xs text-success">¡Enviada a tu profe!</span>
        )}
      </div>
    </div>
  );
}

function Overlay({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="bg-card w-full max-w-sm rounded-3xl border p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
