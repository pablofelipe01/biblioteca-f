"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import MissionEditor from "@/components/MissionEditor";
import AssignmentAssistant, {
  type AssignmentDraft,
} from "@/components/AssignmentAssistant";
import {
  createAssignmentWithMissions,
  type MissionInput,
} from "@/app/(profesor)/tareas/actions";
import {
  SCHOOL_CYCLES,
  READING_EXPERIENCES,
  type MissionType,
  type Resource,
} from "@/lib/types";
import {
  Search,
  Upload,
  Wand2,
  Sparkles,
  Loader2,
  Plus,
  BookOpen,
  X,
  Save,
  Send,
} from "lucide-react";

const inputClass =
  "w-full rounded-xl border bg-card px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

type PickedResource = Pick<
  Resource,
  "id" | "title" | "author" | "school_cycle" | "reading_experience"
>;

export default function NewAssignmentForm({
  initialResource,
  availableGrades = [],
}: {
  initialResource: PickedResource | null;
  availableGrades?: string[];
}) {
  const supabase = createClient();

  const [resource, setResource] = useState<PickedResource | null>(initialResource);
  const [searchQ, setSearchQ] = useState("");
  const [results, setResults] = useState<PickedResource[]>([]);
  const [searching, setSearching] = useState(false);

  const [title, setTitle] = useState(
    initialResource ? `Lectura: ${initialResource.title}` : "",
  );
  const [chapterLabel, setChapterLabel] = useState("");
  const [instructions, setInstructions] = useState("");
  const [grade, setGrade] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [schoolCycle, setSchoolCycle] = useState(
    initialResource?.school_cycle ?? "",
  );
  const [readingExp, setReadingExp] = useState(
    initialResource?.reading_experience ?? "",
  );

  const [missions, setMissions] = useState<MissionInput[]>([]);

  const [parsing, setParsing] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<{
    summary: string;
    themes: string[];
    suggested_cycle: string | null;
    reading_level: string | null;
  } | null>(null);

  async function doSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!searchQ.trim()) return;
    setSearching(true);
    const { data } = await supabase
      .from("resources")
      .select("id, title, author, school_cycle, reading_experience")
      .ilike("title", `%${searchQ.replace(/[%,()]/g, " ")}%`)
      .eq("is_active", true)
      .limit(12);
    setResults((data as PickedResource[]) ?? []);
    setSearching(false);
  }

  function pickResource(r: PickedResource) {
    setResource(r);
    setResults([]);
    setSearchQ("");
    if (!title) setTitle(`Lectura: ${r.title}`);
    if (r.school_cycle) setSchoolCycle(r.school_cycle);
    if (r.reading_experience) setReadingExp(r.reading_experience);
  }

  async function uploadPdf(file: File) {
    setParsing(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/parse-pdf", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok)
        throw new Error(
          [json.error, json.detail].filter(Boolean).join(" — ") ||
            "Error al procesar PDF",
        );
      setExcerpt((prev) => (prev ? `${prev}\n\n${json.text}` : json.text));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al procesar PDF");
    } finally {
      setParsing(false);
    }
  }

  async function summarize() {
    setSummarizing(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ excerpt_text: excerpt }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Error al resumir");
      setSummary(json);
      if (json.suggested_cycle && !schoolCycle) setSchoolCycle(json.suggested_cycle);
      if (json.reading_level && !readingExp) setReadingExp(json.reading_level);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al resumir");
    } finally {
      setSummarizing(false);
    }
  }

  async function generateMissions() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/generate-missions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          excerpt_text: excerpt,
          school_cycle: schoolCycle,
          reading_experience: readingExp,
          num_missions: 3,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Error al generar misiones");
      setMissions(json.missions as MissionInput[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al generar misiones");
    } finally {
      setGenerating(false);
    }
  }

  function addMission(type: MissionType) {
    const base: MissionInput = {
      mission_number: missions.length + 1,
      type,
      title: "",
      points: type === "creative" ? 20 : type === "open" ? 15 : 10,
      data:
        type === "quiz"
          ? { question: "", options: ["", "", "", ""], correct_index: 0, explanation: "" }
          : type === "open"
            ? { prompt: "", rubric: "" }
            : { prompt: "", min_words: 40 },
    };
    setMissions((prev) => [...prev, base]);
  }

  async function save(publish: boolean) {
    setError(null);
    if (!title.trim()) return setError("Ponle un título a la tarea.");
    if (excerpt.trim().length < 50)
      return setError("Pega o sube un fragmento (mínimo 50 caracteres).");
    if (missions.length === 0)
      return setError("Agrega al menos una misión (genera con IA o manual).");

    setSaving(true);
    try {
      await createAssignmentWithMissions({
        resource_id: resource?.id ?? null,
        title: title.trim(),
        chapter_label: chapterLabel || null,
        instructions: instructions || null,
        excerpt_text: excerpt,
        grade: grade || null,
        due_at: dueAt ? new Date(dueAt).toISOString() : null,
        missions: missions.map((m, i) => ({ ...m, mission_number: i + 1 })),
        publish,
      });
      // createAssignmentWithMissions redirige; si llega aquí, no hubo redirect.
    } catch (err) {
      // El redirect de Next lanza NEXT_REDIRECT; no lo tratamos como error.
      if (err instanceof Error && err.message.includes("NEXT_REDIRECT")) return;
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
      setSaving(false);
    }
  }

  function applyDraft(draft: AssignmentDraft) {
    if (draft.title) setTitle(draft.title);
    if (draft.chapter_label) setChapterLabel(draft.chapter_label);
    if (draft.instructions) setInstructions(draft.instructions);
    if (draft.grade) setGrade(draft.grade);
    if (draft.school_cycle) setSchoolCycle(draft.school_cycle);
    if (draft.reading_experience) setReadingExp(draft.reading_experience);
    if (draft.excerpt_text && draft.excerpt_text.trim()) setExcerpt(draft.excerpt_text);
    if (draft.missions && draft.missions.length > 0) {
      setMissions(
        draft.missions.map((m, i) => ({ ...m, mission_number: i + 1 })),
      );
    }
  }

  const busy = parsing || summarizing || generating || saving;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Nueva tarea</h1>

      <AssignmentAssistant
        context={{
          title,
          grade,
          school_cycle: schoolCycle,
          reading_experience: readingExp,
        }}
        onApplyDraft={applyDraft}
      />

      {/* 1. Recurso */}
      <Section step={1} title="Elige el libro (o usa un fragmento propio)">
        {resource ? (
          <div className="bg-card flex items-center gap-3 rounded-xl border p-3">
            <BookOpen className="h-5 w-5 text-brand" />
            <div className="flex-1">
              <p className="font-medium">{resource.title}</p>
              {resource.author && (
                <p className="text-muted text-xs">{resource.author}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setResource(null)}
              className="text-muted hover:text-danger"
              title="Quitar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <form onSubmit={doSearch} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="text-muted pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
                <input
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                  placeholder="Buscar un título del catálogo…"
                  className={`${inputClass} pl-9`}
                />
              </div>
              <button
                type="submit"
                disabled={searching}
                className="bg-adventure rounded-xl px-4 text-sm font-semibold text-white"
              >
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buscar"}
              </button>
            </form>
            {results.length > 0 && (
              <ul className="bg-card max-h-64 divide-y overflow-auto rounded-xl border">
                {results.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => pickResource(r)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-background"
                    >
                      <BookOpen className="text-muted h-4 w-4 shrink-0" />
                      <span className="flex-1">{r.title}</span>
                      <span className="text-muted text-xs">{r.author}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-muted text-xs">
              También puedes saltarte este paso y trabajar solo con un fragmento propio.
            </p>
          </div>
        )}
      </Section>

      {/* 2. Datos de la tarea */}
      <Section step={2} title="Datos de la tarea">
        <div className="grid gap-3 sm:grid-cols-2">
          <Labeled label="Título de la tarea" full>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej. Capítulo 3: El llamado de la aventura"
              className={inputClass}
            />
          </Labeled>
          <Labeled label="Capítulo / fragmento">
            <input
              value={chapterLabel}
              onChange={(e) => setChapterLabel(e.target.value)}
              placeholder="Ej. Cap. 3 o pp. 40-58"
              className={inputClass}
            />
          </Labeled>
          <Labeled label="Curso destinatario">
            <input
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              placeholder="Ej. 7B"
              list="cursos-disponibles"
              className={inputClass}
            />
            {availableGrades.length > 0 && (
              <datalist id="cursos-disponibles">
                {availableGrades.map((g) => (
                  <option key={g} value={g} />
                ))}
              </datalist>
            )}
            {availableGrades.length > 0 && (
              <span className="text-muted mt-1 block text-xs">
                Cursos: {availableGrades.join(", ")}
              </span>
            )}
          </Labeled>
          <Labeled label="Ciclo escolar">
            <select
              value={schoolCycle}
              onChange={(e) => setSchoolCycle(e.target.value)}
              className={inputClass}
            >
              <option value="">—</option>
              {SCHOOL_CYCLES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Labeled>
          <Labeled label="Experiencia lectora">
            <select
              value={readingExp}
              onChange={(e) => setReadingExp(e.target.value)}
              className={inputClass}
            >
              <option value="">—</option>
              {READING_EXPERIENCES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Labeled>
          <Labeled label="Fecha límite">
            <input
              type="datetime-local"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              className={inputClass}
            />
          </Labeled>
          <Labeled label="Consigna / instrucciones" full>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={2}
              placeholder="Qué deben hacer los estudiantes…"
              className={inputClass}
            />
          </Labeled>
        </div>
      </Section>

      {/* 3. Fragmento */}
      <Section step={3} title="El fragmento a leer">
        <textarea
          value={excerpt}
          onChange={(e) => setExcerpt(e.target.value)}
          rows={10}
          placeholder="Pega aquí el texto del fragmento (uso educativo acotado)…"
          className={`${inputClass} font-mono text-xs leading-relaxed`}
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <label className="bg-card inline-flex cursor-pointer items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium hover:border-brand">
            {parsing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            Subir PDF
            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              disabled={parsing}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadPdf(f);
                e.target.value = "";
              }}
            />
          </label>
          <button
            type="button"
            onClick={summarize}
            disabled={busy || excerpt.trim().length < 50}
            className="bg-card inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium hover:border-brand disabled:opacity-50"
          >
            {summarizing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Resumir con IA
          </button>
          <span className="text-muted text-xs">{excerpt.length} caracteres</span>
        </div>

        {summary && (
          <div className="mt-3 rounded-xl bg-brand/5 p-3 text-sm">
            <p className="font-medium">Resumen IA</p>
            <p className="text-muted mt-1">{summary.summary}</p>
            {summary.themes.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {summary.themes.map((t) => (
                  <span
                    key={t}
                    className="rounded-full bg-brand/10 px-2 py-0.5 text-xs text-brand"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </Section>

      {/* 4. Misiones */}
      <Section step={4} title="Misiones (la aventura)">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={generateMissions}
            disabled={busy || excerpt.trim().length < 50}
            className="bg-adventure inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Wand2 className="h-4 w-4" />
            )}
            Generar misiones con IA
          </button>
          <span className="text-muted text-xs">o agrega manualmente:</span>
          {(["quiz", "open", "creative"] as MissionType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => addMission(t)}
              className="bg-card inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium hover:border-brand"
            >
              <Plus className="h-3.5 w-3.5" />
              {t === "quiz" ? "Quiz" : t === "open" ? "Abierta" : "Creativa"}
            </button>
          ))}
        </div>

        {missions.length === 0 ? (
          <p className="text-muted rounded-xl border border-dashed py-8 text-center text-sm">
            Aún no hay misiones. Genera con IA o agrega manualmente.
          </p>
        ) : (
          <div className="space-y-3">
            {missions.map((m, i) => (
              <MissionEditor
                key={i}
                mission={m}
                index={i}
                onChange={(updated) =>
                  setMissions((prev) =>
                    prev.map((x, j) => (j === i ? updated : x)),
                  )
                }
                onRemove={() =>
                  setMissions((prev) => prev.filter((_, j) => j !== i))
                }
              />
            ))}
          </div>
        )}
      </Section>

      {error && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-danger">{error}</p>
      )}

      <div className="sticky bottom-0 flex gap-3 border-t bg-background/80 py-4 backdrop-blur">
        <button
          type="button"
          onClick={() => save(false)}
          disabled={busy}
          className="bg-card inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 font-semibold hover:border-brand disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Guardar borrador
        </button>
        <button
          type="button"
          onClick={() => save(true)}
          disabled={busy}
          className="bg-adventure inline-flex items-center gap-2 rounded-xl px-4 py-2.5 font-semibold text-white disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Publicar tarea
        </button>
      </div>
    </div>
  );
}

function Section({
  step,
  title,
  children,
}: {
  step: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-2 flex items-center gap-2 font-semibold">
        <span className="bg-adventure flex h-6 w-6 items-center justify-center rounded-full text-xs text-white">
          {step}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Labeled({
  label,
  full,
  children,
}: {
  label: string;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${full ? "sm:col-span-2" : ""}`}>
      <span className="text-muted mb-1 block text-xs font-medium">{label}</span>
      {children}
    </label>
  );
}
