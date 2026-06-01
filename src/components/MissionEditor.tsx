"use client";

import type { MissionInput } from "@/app/(profesor)/tareas/actions";
import { Trash2, HelpCircle, PenLine, Wand2 } from "lucide-react";

const TYPE_META: Record<
  MissionInput["type"],
  { label: string; icon: React.ReactNode; color: string }
> = {
  quiz: { label: "Quiz", icon: <HelpCircle className="h-4 w-4" />, color: "text-brand-2" },
  open: { label: "Pregunta abierta", icon: <PenLine className="h-4 w-4" />, color: "text-brand" },
  creative: { label: "Reto creativo", icon: <Wand2 className="h-4 w-4" />, color: "text-accent" },
};

const inputClass =
  "w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

export default function MissionEditor({
  mission,
  index,
  onChange,
  onRemove,
}: {
  mission: MissionInput;
  index: number;
  onChange: (m: MissionInput) => void;
  onRemove?: () => void;
}) {
  const meta = TYPE_META[mission.type];

  function setData(patch: Record<string, unknown>) {
    onChange({ ...mission, data: { ...mission.data, ...patch } });
  }

  const d = mission.data as Record<string, unknown>;

  return (
    <div className="bg-card rounded-2xl border p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className={`flex items-center gap-1.5 text-xs font-semibold ${meta.color}`}>
          {meta.icon}
          {meta.label}
        </span>
        <span className="text-muted text-xs">· Misión {index + 1}</span>
        <div className="ml-auto flex items-center gap-2">
          <label className="text-muted flex items-center gap-1 text-xs">
            Puntos
            <input
              type="number"
              min={0}
              value={mission.points}
              onChange={(e) =>
                onChange({ ...mission, points: parseInt(e.target.value) || 0 })
              }
              className="w-16 rounded-lg border bg-background px-2 py-1 text-sm"
            />
          </label>
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              title="Eliminar misión"
              className="text-muted hover:text-danger"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <input
        value={mission.title}
        onChange={(e) => onChange({ ...mission, title: e.target.value })}
        placeholder="Título épico de la misión"
        className={`${inputClass} mb-3 font-semibold`}
      />

      {mission.type === "quiz" && (
        <div className="space-y-2">
          <textarea
            value={(d.question as string) ?? ""}
            onChange={(e) => setData({ question: e.target.value })}
            placeholder="Pregunta"
            rows={2}
            className={inputClass}
          />
          <div className="space-y-1.5">
            {[0, 1, 2, 3].map((i) => {
              const options = (d.options as string[]) ?? ["", "", "", ""];
              return (
                <label key={i} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`correct-${mission.mission_number}-${index}`}
                    checked={(d.correct_index as number) === i}
                    onChange={() => setData({ correct_index: i })}
                    className="accent-brand"
                  />
                  <input
                    value={options[i] ?? ""}
                    onChange={(e) => {
                      const next = [...options];
                      next[i] = e.target.value;
                      setData({ options: next });
                    }}
                    placeholder={`Opción ${i + 1}`}
                    className={inputClass}
                  />
                </label>
              );
            })}
          </div>
          <textarea
            value={(d.explanation as string) ?? ""}
            onChange={(e) => setData({ explanation: e.target.value })}
            placeholder="Explicación de la respuesta correcta (feedback)"
            rows={2}
            className={inputClass}
          />
        </div>
      )}

      {mission.type === "open" && (
        <div className="space-y-2">
          <textarea
            value={(d.prompt as string) ?? ""}
            onChange={(e) => setData({ prompt: e.target.value })}
            placeholder="Consigna de la pregunta abierta"
            rows={2}
            className={inputClass}
          />
          <textarea
            value={(d.rubric as string) ?? ""}
            onChange={(e) => setData({ rubric: e.target.value })}
            placeholder="Rúbrica: qué hace una buena respuesta"
            rows={2}
            className={inputClass}
          />
        </div>
      )}

      {mission.type === "creative" && (
        <div className="space-y-2">
          <textarea
            value={(d.prompt as string) ?? ""}
            onChange={(e) => setData({ prompt: e.target.value })}
            placeholder="Reto creativo"
            rows={3}
            className={inputClass}
          />
          <label className="text-muted flex items-center gap-2 text-xs">
            Mínimo de palabras
            <input
              type="number"
              min={0}
              value={(d.min_words as number) ?? 40}
              onChange={(e) => setData({ min_words: parseInt(e.target.value) || 0 })}
              className="w-20 rounded-lg border bg-background px-2 py-1 text-sm"
            />
          </label>
        </div>
      )}
    </div>
  );
}
