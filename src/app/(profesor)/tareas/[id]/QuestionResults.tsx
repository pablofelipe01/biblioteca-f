"use client";

import { useState } from "react";
import ImageGallery from "@/components/ImageGallery";
import { averageNota, effectiveScore, formatNota, notaTone, toNota } from "@/lib/grades";
import type { MissionWithImages, StudentRow } from "./page";
import SubmissionReview from "./SubmissionReview";
import { CheckCircle2, ChevronDown, ChevronUp, HelpCircle, PenLine, Wand2 } from "lucide-react";

const TYPE_LABEL = {
  quiz: { label: "Quiz", icon: <HelpCircle className="h-3.5 w-3.5" /> },
  open: { label: "Pregunta abierta", icon: <PenLine className="h-3.5 w-3.5" /> },
  creative: { label: "Reto creativo", icon: <Wand2 className="h-3.5 w-3.5" /> },
} as const;

/**
 * Revisión por pregunta: cada misión con las respuestas de todos los
 * estudiantes, para socializar y corregir en el aula.
 */
export default function QuestionResults({
  missions,
  students,
}: {
  missions: MissionWithImages[];
  students: StudentRow[];
}) {
  if (missions.length === 0) {
    return (
      <p className="text-muted rounded-2xl border border-dashed py-8 text-center text-sm">
        Esta tarea no tiene preguntas.
      </p>
    );
  }
  return (
    <div className="space-y-3">
      {missions.map((m, i) => (
        <QuestionCard key={m.id} mission={m} index={i} students={students} />
      ))}
    </div>
  );
}

function QuestionCard({
  mission,
  index,
  students,
}: {
  mission: MissionWithImages;
  index: number;
  students: StudentRow[];
}) {
  const [open, setOpen] = useState(false);
  const d = mission.data as unknown as Record<string, unknown>;
  const meta = TYPE_LABEL[mission.type];
  const answered = students.filter((s) => s.submissions[mission.id]);
  const missing = students.filter((s) => !s.submissions[mission.id]);
  const avg = averageNota(
    answered.map((s) => {
      const score = effectiveScore(s.submissions[mission.id]);
      return score == null ? null : toNota(score);
    }),
  );
  const statement = String(d.question ?? d.prompt ?? "");

  return (
    <div className="bg-card overflow-hidden rounded-2xl border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-background"
      >
        <span className="bg-adventure flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{mission.title || `Pregunta ${index + 1}`}</p>
          <p className="text-muted flex items-center gap-1 text-xs">
            {meta.icon} {meta.label} · {answered.length} de {students.length} respondieron
          </p>
        </div>
        <div className="text-right">
          <p className={`text-lg font-bold ${notaTone(avg)}`}>{formatNota(avg)}</p>
          <p className="text-muted text-[11px]">promedio</p>
        </div>
        {open ? <ChevronUp className="text-muted h-4 w-4" /> : <ChevronDown className="text-muted h-4 w-4" />}
      </button>

      {open && (
        <div className="space-y-3 border-t px-4 py-4">
          {statement && <p className="text-base font-medium whitespace-pre-wrap">{statement}</p>}
          <ImageGallery images={mission.images} size="sm" />

          {mission.type === "quiz" && <QuizDistribution data={d} students={answered} missionId={mission.id} />}

          {answered.length === 0 ? (
            <p className="text-muted text-sm italic">Nadie ha respondido esta pregunta todavía.</p>
          ) : (
            <div className="space-y-2">
              {answered.map((s) => (
                <SubmissionReview
                  key={s.id}
                  mission={mission}
                  submission={s.submissions[mission.id]}
                  heading={s.full_name ?? "Estudiante"}
                />
              ))}
            </div>
          )}

          {missing.length > 0 && (
            <p className="text-muted text-xs">
              <span className="font-medium">Sin responder ({missing.length}):</span>{" "}
              {missing.map((s) => s.full_name ?? "Estudiante").join(", ")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** Cuántos eligieron cada opción de un quiz. */
function QuizDistribution({
  data,
  students,
  missionId,
}: {
  data: Record<string, unknown>;
  students: StudentRow[];
  missionId: string;
}) {
  const options = Array.isArray(data.options) ? (data.options as string[]) : [];
  const correct = data.correct_index as number | undefined;
  const counts = options.map(
    (_, i) =>
      students.filter(
        (s) => (s.submissions[missionId].response as { selected_index?: number } | null)?.selected_index === i,
      ).length,
  );
  const total = students.length || 1;

  return (
    <ul className="space-y-1.5">
      {options.map((opt, i) => (
        <li key={i} className="text-sm">
          <div className="flex items-center gap-2">
            <span className={`flex-1 ${i === correct ? "font-semibold text-success" : ""}`}>
              {i === correct && <CheckCircle2 className="mr-1 inline h-4 w-4" />}
              {opt}
            </span>
            <span className="text-muted text-xs">
              {counts[i]} ({Math.round((counts[i] / total) * 100)}%)
            </span>
          </div>
          <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-border">
            <div
              className={`h-full rounded-full ${i === correct ? "bg-success" : "bg-adventure"}`}
              style={{ width: `${(counts[i] / total) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
