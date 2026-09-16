"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import TutorChat from "./TutorChat";
import { askTeacher, joinGroup } from "@/app/(alumno)/actions";
import type { GroupInfo, StudentMission, StudentQuestion } from "./page";
import type { AccessLink } from "@/lib/types";
import type { SignedImage } from "@/lib/images-server";
import ImageGallery from "@/components/ImageGallery";
import ImageUploader, { type UploadedImage } from "@/components/ImageUploader";
import { formatNota, notaTone, toNota } from "@/lib/grades";
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
  Users,
  MessageSquareHeart,
  Trophy,
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
  referenceImages,
  missions: initial,
  questions,
  orgId,
  userId,
  group,
}: {
  assignmentId: string;
  title: string;
  chapterLabel: string | null;
  instructions: string | null;
  excerpt: string;
  accessLinks: AccessLink[];
  referenceImages: SignedImage[];
  missions: Mission[];
  questions: StudentQuestion[];
  orgId: string | null;
  userId: string;
  group: GroupInfo | null;
}) {
  const router = useRouter();
  const [missions, setMissions] = useState<Mission[]>(initial);
  const [award, setAward] = useState<
    { code: string; name: string; icon: string | null }[] | null
  >(null);
  const [celebrate, setCelebrate] = useState(false);

  const completedCount = missions.filter((m) => m.done).length;
  const percent =
    missions.length > 0 ? Math.round((completedCount / missions.length) * 100) : 0;
  // En grupos de autoinscripción hay que elegir grupo antes de empezar.
  const needsGroup = !!group && group.mode === "self" && !group.myGroupId;

  function onGraded(missionId: string, result: GradeResult, answer: MissionAnswer) {
    const wasDone = !!missions.find((m) => m.id === missionId)?.done;
    setMissions((prev) =>
      prev.map((m) =>
        m.id === missionId
          ? {
              ...m,
              done: true,
              ai_feedback: result.feedback,
              score: result.score,
              earned_points: result.earned_points,
              answer_text: answer.text,
              answer_images: answer.images,
            }
          : m,
      ),
    );
    if (result.new_badges.length > 0) setAward(result.new_badges);
    if (result.adventure_completed && !wasDone) {
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

        {referenceImages.length > 0 && (
          <div className="bg-card rounded-2xl border p-4">
            <p className="mb-2 text-sm font-semibold">Imágenes de referencia</p>
            <ImageGallery images={referenceImages} />
          </div>
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
      <div className="space-y-4">
        <ProgressHero
          percent={percent}
          completed={completedCount}
          total={missions.length}
        />

        {group && (
          <GroupPanel assignmentId={assignmentId} group={group} />
        )}

        <div className="flex items-center justify-between">
          <h2 className="font-semibold">El mapa de la aventura</h2>
          <span className="text-muted text-sm">
            {completedCount}/{missions.length} misiones
          </span>
        </div>

        <ol className="space-y-3">
          {missions.map((m, i) => {
            const unlocked = !needsGroup && (i === 0 || missions[i - 1].done);
            return (
              <li key={m.id} className="relative">
                {i < missions.length - 1 && (
                  <span className="absolute left-4 top-10 h-full w-0.5 bg-border" />
                )}
                <MissionStep
                  mission={m}
                  index={i}
                  unlocked={unlocked}
                  lockedReason={
                    needsGroup
                      ? "Elige tu grupo para desbloquear las misiones."
                      : "Completa la misión anterior para desbloquear esta."
                  }
                  onGraded={onGraded}
                  orgId={orgId}
                  userId={userId}
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
        <CompletionOverlay
          title={title}
          earnedPoints={missions.reduce((acc, m) => acc + m.earned_points, 0)}
          onClose={() => setCelebrate(false)}
        />
      )}
    </div>
  );
}

interface MissionAnswer {
  text: string | null;
  images: SignedImage[];
}

function MissionStep({
  mission,
  index,
  unlocked,
  lockedReason,
  onGraded,
  orgId,
  userId,
}: {
  mission: Mission;
  index: number;
  unlocked: boolean;
  lockedReason: string;
  onGraded: (id: string, result: GradeResult, answer: MissionAnswer) => void;
  orgId: string | null;
  userId: string;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const [text, setText] = useState("");
  const [images, setImages] = useState<UploadedImage[]>([]);
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
      if (text.trim().length < 1 && images.length === 0)
        return setError("Escribe tu respuesta o sube una imagen.");
      response = { text: text.trim(), images: images.map((i) => i.path) };
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
      onGraded(mission.id, json, {
        text: mission.type === "quiz" ? null : text.trim() || null,
        images,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al enviar.");
    } finally {
      setSubmitting(false);
    }
  }

  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const nota = mission.score != null ? toNota(mission.score) : null;

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
        {mission.done && nota != null && (
          <span className="text-right">
            <span className={`block text-lg font-bold leading-none ${notaTone(nota)}`}>
              {formatNota(nota)}
            </span>
            <span className="text-muted text-[10px]">nota</span>
          </span>
        )}
      </div>

      {!unlocked && <p className="text-muted mt-3 text-xs">{lockedReason}</p>}

      {mission.done && (
        <div className="mt-3 space-y-2">
          {(mission.answer_text || mission.answer_images.length > 0) && (
            <div className="bg-background rounded-xl border p-3 text-sm">
              <p className="text-muted mb-1 text-xs font-medium">Tu respuesta</p>
              {mission.answer_text && (
                <p className="whitespace-pre-wrap">{mission.answer_text}</p>
              )}
              {mission.answer_images.length > 0 && (
                <div className="mt-2">
                  <ImageGallery images={mission.answer_images} size="sm" />
                </div>
              )}
            </div>
          )}
          <div className="rounded-xl bg-green-50 p-3 text-sm">
            <p className="inline-flex items-center gap-1 font-medium text-success">
              <Sparkles className="h-3.5 w-3.5" /> +{mission.earned_points} puntos
            </p>
            {mission.ai_feedback && (
              <p className="mt-1 text-foreground/80">{mission.ai_feedback}</p>
            )}
          </div>
          {mission.teacher_comment && (
            <div className="rounded-xl border border-accent/40 bg-amber-50 p-3 text-sm">
              <p className="mb-1 inline-flex items-center gap-1.5 font-semibold text-amber-700">
                <MessageSquareHeart className="h-4 w-4" /> Tu profe dice:
              </p>
              <p className="whitespace-pre-wrap text-base leading-relaxed">
                {mission.teacher_comment}
              </p>
            </div>
          )}
        </div>
      )}

      {unlocked && !mission.done && (
        <div className="mt-3 space-y-3">
          {mission.reference_images.length > 0 && (
            <ImageGallery images={mission.reference_images} />
          )}

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
              {orgId && (
                <div>
                  <p className="text-muted mb-1.5 text-xs">
                    ¿Hiciste un dibujo o lo escribiste en tu cuaderno? Súbele una foto.
                  </p>
                  <ImageUploader
                    orgId={orgId}
                    folder={`answers/${userId}`}
                    value={images}
                    onChange={setImages}
                    label="Subir foto"
                    compact
                  />
                </div>
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

/** Mensaje motivacional según el porcentaje de avance. */
function progressMessage(percent: number): { title: string; text: string } {
  if (percent === 0)
    return { title: "¡Tu aventura empieza aquí!", text: "Lee con calma y lánzate a la primera misión. ¡Tú puedes!" };
  if (percent <= 33)
    return { title: "¡Buen comienzo!", text: "Ya diste el primer paso. Cada misión te hace un lector más valiente." };
  if (percent <= 66)
    return { title: "¡Vas por la mitad del camino!", text: "Sigue así, tu esfuerzo se nota. ¡No te detengas!" };
  if (percent < 100)
    return { title: "¡Ya casi llegas a la meta!", text: "Te falta muy poquito. ¡Termina con toda la energía!" };
  return { title: "¡Tarea completada!", text: "Cumpliste con responsabilidad y alcanzaste tu objetivo. ¡Estamos orgullosos de ti!" };
}

function ProgressHero({
  percent,
  completed,
  total,
}: {
  percent: number;
  completed: number;
  total: number;
}) {
  const msg = progressMessage(percent);
  const done = percent >= 100;
  // La mascota camina sobre la barra; la limitamos para que no se salga.
  const mascotLeft = Math.min(Math.max(percent, 4), 96);

  return (
    <div
      className={`overflow-hidden rounded-2xl border p-4 ${
        done ? "border-success/40 bg-green-50" : "bg-card"
      }`}
    >
      <div className="flex items-center gap-4">
        <div
          className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-4xl ${
            done ? "bg-success/15" : "bg-brand/10"
          }`}
          aria-hidden
        >
          <span className={done ? "animate-trophy" : "animate-float"}>
            {done ? "🏆" : percent === 0 ? "📖" : percent <= 66 ? "🚀" : "⭐"}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-muted text-xs font-medium">Avance de la tarea</p>
          <p className={`text-3xl font-extrabold leading-tight ${done ? "text-success" : "text-brand"}`}>
            {percent}%
          </p>
          <p className="font-semibold">{msg.title}</p>
          <p className="text-muted text-sm">{msg.text}</p>
        </div>
      </div>

      <div className="relative mt-6">
        <span
          className="animate-walk absolute -top-6 text-xl transition-[left] duration-700"
          style={{ left: `${mascotLeft}%` }}
          aria-hidden
        >
          {done ? "🎉" : "🦉"}
        </span>
        <div
          className="h-3 overflow-hidden rounded-full bg-border"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Avance de la tarea"
        >
          <div
            className={`progress-stripes h-full rounded-full transition-all duration-700 ${
              done ? "bg-success" : "bg-adventure"
            }`}
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="text-muted mt-1 text-right text-xs">
          {completed} de {total} misiones
        </p>
      </div>

      {done && (
        <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-success px-3 py-1 text-xs font-bold text-white">
          <Trophy className="h-3.5 w-3.5" /> ¡Tarea completada!
        </p>
      )}
    </div>
  );
}

const CONFETTI_COLORS = ["#6d28d9", "#2563eb", "#f59e0b", "#16a34a", "#ec4899", "#06b6d4"];

function CompletionOverlay({
  title,
  earnedPoints,
  onClose,
}: {
  title: string;
  earnedPoints: number;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/50 p-4"
      onClick={onClose}
    >
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        {Array.from({ length: 48 }, (_, i) => (
          <span
            key={i}
            className="confetti-piece"
            style={{
              left: `${(i * 37) % 100}%`,
              backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
              animationDelay: `${(i % 12) * 0.15}s`,
              animationDuration: `${2.4 + ((i * 7) % 10) / 10}s`,
              width: i % 3 === 0 ? 6 : 9,
              height: i % 3 === 0 ? 12 : 9,
              borderRadius: i % 4 === 0 ? "9999px" : "2px",
            }}
          />
        ))}
      </div>
      <div
        className="bg-card animate-pop-in relative w-full max-w-sm rounded-3xl border p-6 text-center shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="animate-trophy text-7xl" aria-hidden>
          🏆
        </div>
        <PartyPopper className="mx-auto mt-2 h-8 w-8 text-accent" />
        <h3 className="mt-2 text-2xl font-extrabold">¡Lo lograste!</h3>
        <p className="mt-2 text-sm leading-relaxed">
          Terminaste <span className="font-semibold">{title}</span>. Felicitaciones por
          tu <span className="font-semibold text-brand">responsabilidad</span> y por
          alcanzar tu <span className="font-semibold text-brand">objetivo</span>. ¡Cada
          lectura te hace crecer!
        </p>
        <p className="mt-3 inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-700">
          <Sparkles className="h-4 w-4" /> {earnedPoints} puntos en esta aventura
        </p>
        <div>
          <button
            onClick={onClose}
            className="bg-adventure mt-4 rounded-xl px-5 py-2 font-semibold text-white"
          >
            ¡Seguir aventurando!
          </button>
        </div>
      </div>
    </div>
  );
}

function GroupPanel({
  assignmentId,
  group,
}: {
  assignmentId: string;
  group: GroupInfo;
}) {
  const router = useRouter();
  const [choice, setChoice] = useState<string>("");
  const [changing, setChanging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const mine = group.groups.find((g) => g.id === group.myGroupId) ?? null;
  const label = (g: GroupInfo["groups"][number]) =>
    g.name?.trim() ? `Grupo ${g.number} · ${g.name}` : `Grupo ${g.number}`;
  const isFull = (g: GroupInfo["groups"][number]) =>
    group.maxSize != null &&
    g.id !== group.myGroupId &&
    g.members.length >= group.maxSize;

  function join() {
    if (!choice) return setError("Elige un grupo de la lista.");
    setError(null);
    start(async () => {
      try {
        await joinGroup(assignmentId, choice);
        setChanging(false);
        setChoice("");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo unir al grupo.");
      }
    });
  }

  const showPicker = group.mode === "self" && (!mine || changing);

  return (
    <div className="bg-card rounded-2xl border p-4">
      <p className="inline-flex items-center gap-1.5 text-sm font-semibold">
        <Users className="h-4 w-4 text-brand" />
        Tarea grupal{mine ? ` · ${label(mine)}` : ""}
      </p>
      <p className="text-muted mt-0.5 text-xs">
        Cada integrante responde sus propias misiones.
      </p>

      {mine && !changing && (
        <div className="mt-2">
          <div className="flex flex-wrap gap-1.5">
            {mine.members.map((name, i) => (
              <span
                key={i}
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                  name === "Tú" ? "bg-adventure text-white" : "bg-brand/10 text-brand"
                }`}
              >
                {name}
              </span>
            ))}
          </div>
          {group.mode === "self" && (
            <button
              onClick={() => setChanging(true)}
              className="text-brand mt-2 text-xs font-medium hover:underline"
            >
              Cambiar de grupo
            </button>
          )}
        </div>
      )}

      {!mine && group.mode === "teacher" && (
        <p className="mt-2 rounded-xl bg-background p-2.5 text-xs">
          Tu profe aún no te asigna grupo. Mientras tanto, puedes avanzar con tus misiones.
        </p>
      )}

      {showPicker && (
        <div className="mt-3 space-y-2">
          {group.groups.length === 0 ? (
            <p className="text-muted text-xs">Tu profe aún no ha creado los grupos.</p>
          ) : (
            <>
              <p className="text-xs font-medium">
                {mine ? "Elige tu nuevo grupo:" : "Elige tu grupo para empezar:"}
              </p>
              <div className="flex flex-wrap gap-2">
                <select
                  value={choice}
                  onChange={(e) => setChoice(e.target.value)}
                  className="min-w-0 flex-1 rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                >
                  <option value="">Selecciona un grupo…</option>
                  {group.groups.map((g) => (
                    <option key={g.id} value={g.id} disabled={isFull(g) || g.id === group.myGroupId}>
                      {label(g)} ({g.members.length}
                      {group.maxSize != null ? `/${group.maxSize}` : ""} integrantes)
                      {isFull(g) ? " · completo" : ""}
                    </option>
                  ))}
                </select>
                <button
                  onClick={join}
                  disabled={pending || !choice}
                  className="bg-adventure inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
                  Unirme
                </button>
                {mine && (
                  <button
                    onClick={() => {
                      setChanging(false);
                      setError(null);
                    }}
                    className="text-muted text-xs hover:text-foreground"
                  >
                    Cancelar
                  </button>
                )}
              </div>
              {choice && (
                <p className="text-muted text-xs">
                  Integrantes:{" "}
                  {group.groups.find((g) => g.id === choice)?.members.join(", ") ||
                    "nadie todavía. ¡Sé el primero!"}
                </p>
              )}
            </>
          )}
          {error && <p className="text-xs text-danger">{error}</p>}
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
