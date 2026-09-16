"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import ImageGallery from "@/components/ImageGallery";
import {
  setPublish,
  updateAssignmentGrade,
} from "@/app/(profesor)/tareas/actions";
import type { SignedImage } from "@/lib/images-server";
import type { Assignment, AssignmentGroup } from "@/lib/types";
import type { MissionWithImages, StudentRow } from "./page";
import GroupManager from "./GroupManager";
import StudentResults from "./StudentResults";
import {
  Send,
  EyeOff,
  Save,
  Loader2,
  ChevronDown,
  ChevronUp,
  Pencil,
  X,
  GraduationCap,
  HelpCircle,
  PenLine,
  Wand2,
  Users,
} from "lucide-react";

const TYPE_LABEL = {
  quiz: { label: "Quiz", icon: <HelpCircle className="h-3.5 w-3.5" /> },
  open: { label: "Pregunta abierta", icon: <PenLine className="h-3.5 w-3.5" /> },
  creative: { label: "Reto creativo", icon: <Wand2 className="h-3.5 w-3.5" /> },
} as const;

export default function AssignmentDetail({
  assignment,
  referenceImages,
  missions,
  students,
  groups,
  availableGrades = [],
}: {
  assignment: Assignment;
  referenceImages: SignedImage[];
  missions: MissionWithImages[];
  students: StudentRow[];
  groups: AssignmentGroup[];
  availableGrades?: string[];
}) {
  const [published, setPublished] = useState(assignment.is_published);
  const [pubPending, startPub] = useTransition();
  const [showExcerpt, setShowExcerpt] = useState(false);
  const [showMissions, setShowMissions] = useState(false);

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

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div className="bg-card flex flex-col gap-3 rounded-2xl border p-5 sm:flex-row sm:items-center">
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{assignment.title}</h1>
          <p className="text-muted text-sm">
            {assignment.chapter_label && <>{assignment.chapter_label}</>}
            {assignment.due_at && (
              <>
                {assignment.chapter_label ? " · " : ""}
                Entrega {new Date(assignment.due_at).toLocaleString("es")}
              </>
            )}
          </p>
          {assignment.is_group && (
            <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">
              <Users className="h-3.5 w-3.5" /> Tarea grupal ·{" "}
              {assignment.group_mode === "self" ? "los estudiantes eligen grupo" : "grupos asignados por el docente"}
            </p>
          )}
          <GradeEditor
            assignmentId={assignment.id}
            current={assignment.grade}
            options={availableGrades}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/tareas/${assignment.id}/editar`}
            className="bg-card inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold hover:border-brand"
          >
            <Pencil className="h-4 w-4" /> Editar tarea
          </Link>
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
      </div>

      {(assignment.instructions || referenceImages.length > 0) && (
        <div className="bg-card space-y-3 rounded-2xl border p-4">
          {assignment.instructions && <p className="text-sm">{assignment.instructions}</p>}
          <ImageGallery images={referenceImages} />
        </div>
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

      {/* Misiones (solo lectura; se editan en «Editar tarea») */}
      <div className="bg-card rounded-2xl border">
        <button
          onClick={() => setShowMissions((v) => !v)}
          className="flex w-full items-center justify-between p-4 text-sm font-semibold"
        >
          Misiones ({missions.length})
          {showMissions ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {showMissions && (
          <ol className="divide-y border-t">
            {missions.map((m, i) => {
              const d = m.data as unknown as Record<string, unknown>;
              const meta = TYPE_LABEL[m.type];
              return (
                <li key={m.id} className="space-y-2 p-4">
                  <p className="text-sm font-semibold">
                    {i + 1}. {m.title || `Misión ${i + 1}`}
                  </p>
                  <p className="text-muted flex items-center gap-1 text-xs">
                    {meta.icon} {meta.label} · {m.points} pts
                  </p>
                  <p className="text-sm">{(d.question as string) ?? (d.prompt as string) ?? ""}</p>
                  <ImageGallery images={m.images} size="sm" />
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {assignment.is_group && (
        <GroupManager
          assignmentId={assignment.id}
          groups={groups}
          students={students}
          mode={assignment.group_mode}
          maxSize={assignment.group_max_size}
        />
      )}

      <StudentResults
        missions={missions}
        students={students}
        isGroup={assignment.is_group}
        groups={groups}
      />
    </div>
  );
}

function GradeEditor({
  assignmentId,
  current,
  options,
}: {
  assignmentId: string;
  current: string | null;
  options: string[];
}) {
  const [grade, setGrade] = useState(current ?? "");
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();

  function save() {
    start(async () => {
      await updateAssignmentGrade(assignmentId, grade);
      setEditing(false);
    });
  }

  const invalid =
    !!current && options.length > 0 && !options.includes(current);

  if (!editing) {
    return (
      <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
        <span className="inline-flex items-center gap-1">
          <GraduationCap className="text-muted h-4 w-4" />
          {current ? (
            <>
              Curso <span className="font-semibold">{current}</span>
            </>
          ) : (
            <span className="text-muted">Sin curso asignado</span>
          )}
        </span>
        {invalid && (
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
            ⚠ Curso inválido: ningún alumno la verá
          </span>
        )}
        <button
          onClick={() => setEditing(true)}
          className="text-brand inline-flex items-center gap-1 text-xs font-medium hover:underline"
        >
          <Pencil className="h-3 w-3" /> Editar curso
        </button>
      </div>
    );
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <input
        value={grade}
        onChange={(e) => setGrade(e.target.value)}
        list="cursos-detalle"
        placeholder="Ej. 10A"
        className="w-32 rounded-lg border bg-background px-3 py-1.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
      />
      {options.length > 0 && (
        <datalist id="cursos-detalle">
          {options.map((g) => (
            <option key={g} value={g} />
          ))}
        </datalist>
      )}
      <button
        onClick={save}
        disabled={pending}
        className="bg-adventure inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
      >
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
        Guardar
      </button>
      <button
        onClick={() => {
          setGrade(current ?? "");
          setEditing(false);
        }}
        className="text-muted inline-flex items-center gap-1 text-xs hover:text-foreground"
      >
        <X className="h-3.5 w-3.5" /> Cancelar
      </button>
      {options.length > 0 && (
        <span className="text-muted basis-full text-xs">
          Cursos: {options.join(", ")}
        </span>
      )}
    </div>
  );
}
