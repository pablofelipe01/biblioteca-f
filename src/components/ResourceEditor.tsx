"use client";

import { useState, useTransition } from "react";
import {
  createResource,
  updateResource,
  deleteResource,
  type ResourceInput,
} from "@/app/admin/actions";
import { SCHOOL_CYCLES, READING_EXPERIENCES, type AccessLink } from "@/lib/types";
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  Save,
  Trash2,
  Plus,
  X,
  CheckCircle2,
  Link2,
} from "lucide-react";

export interface EditableResource {
  id: string;
  title: string;
  author: string | null;
  synopsis: string | null;
  genre: string | null;
  school_cycle: string | null;
  reading_experience: string | null;
  is_active: boolean;
  access_links: AccessLink[];
}

const inputClass =
  "w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

const LINK_TYPES = [
  { value: "", label: "Tipo…" },
  { value: "dominio_publico", label: "Dominio público" },
  { value: "biblioteca", label: "Biblioteca pública" },
  { value: "repositorio", label: "Repositorio oficial" },
  { value: "editorial", label: "Editorial" },
  { value: "otro", label: "Otro" },
];

export default function ResourceEditor({
  resource,
  defaultOpen = false,
  onDone,
}: {
  resource?: EditableResource;
  defaultOpen?: boolean;
  onDone?: () => void;
}) {
  const isNew = !resource;
  const [open, setOpen] = useState(defaultOpen || isNew);
  const [form, setForm] = useState<ResourceInput>({
    title: resource?.title ?? "",
    author: resource?.author ?? "",
    synopsis: resource?.synopsis ?? "",
    genre: resource?.genre ?? "",
    school_cycle: resource?.school_cycle ?? "",
    reading_experience: resource?.reading_experience ?? "",
    is_active: resource?.is_active ?? true,
    access_links: resource?.access_links ?? [],
  });
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function set<K extends keyof ResourceInput>(key: K, value: ResourceInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  }

  function setLink(i: number, patch: Partial<AccessLink>) {
    setForm((f) => ({
      ...f,
      access_links: f.access_links.map((l, j) => (j === i ? { ...l, ...patch } : l)),
    }));
  }

  function save() {
    setError(null);
    start(async () => {
      try {
        if (isNew) {
          await createResource(form);
          onDone?.();
        } else {
          await updateResource(resource!.id, form);
          setSaved(true);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al guardar.");
      }
    });
  }

  function remove() {
    if (!resource) return;
    if (!confirm(`¿Eliminar "${resource.title}"? Esta acción no se puede deshacer.`))
      return;
    setError(null);
    start(async () => {
      try {
        await deleteResource(resource.id);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al eliminar.");
      }
    });
  }

  return (
    <div className="bg-card rounded-2xl border">
      {!isNew && (
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center gap-2 p-3 text-left"
        >
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${form.is_active ? "bg-success" : "bg-border"}`}
            title={form.is_active ? "Activo" : "Inactivo"}
          />
          <span className="line-clamp-1 flex-1 text-sm font-medium">
            {form.title || "(sin título)"}
          </span>
          <span className="text-muted line-clamp-1 hidden text-xs sm:block">
            {form.author}
          </span>
          {open ? (
            <ChevronUp className="text-muted h-4 w-4" />
          ) : (
            <ChevronDown className="text-muted h-4 w-4" />
          )}
        </button>
      )}

      {open && (
        <div className={`space-y-3 ${isNew ? "p-4" : "border-t p-4"}`}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="text-muted mb-1 block text-xs font-medium">Título</span>
              <input
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className="text-muted mb-1 block text-xs font-medium">Autor</span>
              <input
                value={form.author ?? ""}
                onChange={(e) => set("author", e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className="text-muted mb-1 block text-xs font-medium">Género</span>
              <input
                value={form.genre ?? ""}
                onChange={(e) => set("genre", e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className="text-muted mb-1 block text-xs font-medium">Ciclo escolar</span>
              <select
                value={form.school_cycle ?? ""}
                onChange={(e) => set("school_cycle", e.target.value)}
                className={inputClass}
              >
                <option value="">—</option>
                {SCHOOL_CYCLES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-muted mb-1 block text-xs font-medium">
                Experiencia lectora
              </span>
              <select
                value={form.reading_experience ?? ""}
                onChange={(e) => set("reading_experience", e.target.value)}
                className={inputClass}
              >
                <option value="">—</option>
                {READING_EXPERIENCES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="block sm:col-span-2">
              <span className="text-muted mb-1 block text-xs font-medium">Reseña</span>
              <textarea
                value={form.synopsis ?? ""}
                onChange={(e) => set("synopsis", e.target.value)}
                rows={3}
                className={inputClass}
              />
            </label>
          </div>

          {/* Enlaces legales */}
          <div>
            <p className="mb-1 flex items-center gap-1.5 text-xs font-medium">
              <Link2 className="h-3.5 w-3.5" /> Enlaces legales
            </p>
            <div className="space-y-2">
              {form.access_links.map((l, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <input
                    value={l.label ?? ""}
                    onChange={(e) => setLink(i, { label: e.target.value })}
                    placeholder="Etiqueta"
                    className={`${inputClass} flex-1 min-w-[8rem]`}
                  />
                  <input
                    value={l.url}
                    onChange={(e) => setLink(i, { url: e.target.value })}
                    placeholder="https://…"
                    className={`${inputClass} flex-[2] min-w-[12rem]`}
                  />
                  <select
                    value={l.type ?? ""}
                    onChange={(e) => setLink(i, { type: e.target.value })}
                    className={`${inputClass} w-auto`}
                  >
                    {LINK_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() =>
                      set(
                        "access_links",
                        form.access_links.filter((_, j) => j !== i),
                      )
                    }
                    className="text-muted hover:text-danger"
                    title="Quitar enlace"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  set("access_links", [
                    ...form.access_links,
                    { label: "", url: "", type: "" },
                  ])
                }
                className="text-muted inline-flex items-center gap-1 text-xs font-medium hover:text-brand"
              >
                <Plus className="h-3.5 w-3.5" /> Agregar enlace
              </button>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => set("is_active", e.target.checked)}
              className="accent-brand"
            />
            Activo (visible en el catálogo)
          </label>

          {error && <p className="text-sm text-danger">{error}</p>}

          <div className="flex items-center gap-2">
            <button
              onClick={save}
              disabled={pending}
              className="bg-adventure inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {isNew ? "Crear recurso" : "Guardar"}
            </button>
            {!isNew && (
              <button
                onClick={remove}
                disabled={pending}
                className="text-danger inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-red-50 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" /> Eliminar
              </button>
            )}
            {saved && !pending && (
              <span className="inline-flex items-center gap-1 text-xs text-success">
                <CheckCircle2 className="h-3.5 w-3.5" /> Guardado
              </span>
            )}
            {isNew && onDone && (
              <button
                onClick={onDone}
                className="text-muted ml-auto text-sm hover:text-foreground"
              >
                Cancelar
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
