"use client";

import { useEffect, useSyncExternalStore, useState } from "react";
import { toParagraphs } from "@/lib/excerpt";
import { BookOpenText, Maximize2, Minimize2, Minus, Plus, X } from "lucide-react";

// Tamaños de letra disponibles (px). El elegido se recuerda en el dispositivo.
const SIZES = [14, 16, 18, 21, 24, 28];
const DEFAULT_SIZE = 1;
const SIZE_KEY = "leo-reader-size";

type Theme = "claro" | "sepia" | "oscuro";
const THEMES: Record<Theme, { label: string; className: string }> = {
  claro: { label: "Claro", className: "bg-white text-neutral-900" },
  sepia: { label: "Sepia", className: "bg-[#f6efdf] text-[#3b2f1e]" },
  oscuro: { label: "Oscuro", className: "bg-neutral-900 text-neutral-100" },
};

// Preferencia de tamaño compartida por todas las instancias, sin desajustes
// de hidratación (en el servidor siempre es el tamaño por defecto).
const listeners = new Set<() => void>();
function readSize(): number {
  const n = Number(window.localStorage.getItem(SIZE_KEY));
  return Number.isInteger(n) && n >= 0 && n < SIZES.length ? n : DEFAULT_SIZE;
}
function writeSize(n: number) {
  window.localStorage.setItem(SIZE_KEY, String(n));
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

function useFontSize() {
  const index = useSyncExternalStore(subscribe, readSize, () => DEFAULT_SIZE);
  return {
    px: SIZES[index],
    canShrink: index > 0,
    canGrow: index < SIZES.length - 1,
    shrink: () => writeSize(Math.max(0, index - 1)),
    grow: () => writeSize(Math.min(SIZES.length - 1, index + 1)),
  };
}

/** Texto del fragmento con párrafos separados. */
export function ExcerptText({
  text,
  fontSize,
  className = "",
}: {
  text: string;
  fontSize?: number;
  className?: string;
}) {
  return (
    <div className={`space-y-[1em] ${className}`} style={fontSize ? { fontSize } : undefined}>
      {toParagraphs(text).map((p, i) => (
        <p key={i} className="whitespace-pre-line leading-[1.7]">
          {p}
        </p>
      ))}
    </div>
  );
}

function SizeControls({ font }: { font: ReturnType<typeof useFontSize> }) {
  return (
    <div className="flex items-center overflow-hidden rounded-lg border">
      <button
        type="button"
        onClick={font.shrink}
        disabled={!font.canShrink}
        title="Letra más pequeña"
        aria-label="Letra más pequeña"
        className="flex items-center px-2 py-1.5 hover:bg-black/5 disabled:opacity-30"
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <span className="border-x px-2 py-1 text-xs font-semibold" aria-hidden>
        A
      </span>
      <button
        type="button"
        onClick={font.grow}
        disabled={!font.canGrow}
        title="Letra más grande"
        aria-label="Letra más grande"
        className="flex items-center px-2 py-1.5 hover:bg-black/5 disabled:opacity-30"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/**
 * Cuadro «Fragmento» del estudiante: tamaño de letra, ancho completo y modo
 * lectura a pantalla completa.
 */
export default function ExcerptReader({
  text,
  title,
  wide,
  onToggleWide,
}: {
  text: string;
  title: string;
  wide?: boolean;
  onToggleWide?: () => void;
}) {
  const font = useFontSize();
  const [reading, setReading] = useState(false);

  return (
    <div className="bg-card rounded-2xl border">
      <div className="flex flex-wrap items-center gap-2 border-b p-3">
        <p className="mr-auto pl-1 text-sm font-semibold">Fragmento</p>
        <SizeControls font={font} />
        {onToggleWide && (
          <button
            type="button"
            onClick={onToggleWide}
            title={wide ? "Volver al tamaño normal" : "Usar todo el ancho"}
            className="hidden items-center gap-1 rounded-lg border px-2 py-1.5 text-xs font-medium hover:border-brand lg:inline-flex"
          >
            {wide ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            {wide ? "Normal" : "Ancho"}
          </button>
        )}
        <button
          type="button"
          onClick={() => setReading(true)}
          className="bg-adventure inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white"
        >
          <BookOpenText className="h-3.5 w-3.5" /> Modo lectura
        </button>
      </div>
      <div className={wide ? "p-4 sm:p-6" : "max-h-[70vh] overflow-auto p-4"}>
        <ExcerptText text={text} fontSize={font.px} className={wide ? "mx-auto max-w-4xl" : ""} />
      </div>

      {reading && (
        <ReadingMode text={text} title={title} font={font} onClose={() => setReading(false)} />
      )}
    </div>
  );
}

function ReadingMode({
  text,
  title,
  font,
  onClose,
}: {
  text: string;
  title: string;
  font: ReturnType<typeof useFontSize>;
  onClose: () => void;
}) {
  const [theme, setTheme] = useState<Theme>("sepia");

  // Esc cierra; el fondo de la página no se desplaza mientras se lee.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Modo lectura: ${title}`}
      className={`fixed inset-0 z-50 flex flex-col ${THEMES[theme].className}`}
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-current/15 px-4 py-2">
        <p className="mr-auto truncate text-sm font-semibold">{title}</p>
        <SizeControls font={font} />
        <div className="flex overflow-hidden rounded-lg border text-xs">
          {(Object.keys(THEMES) as Theme[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTheme(t)}
              className={`px-2 py-1.5 font-medium ${theme === t ? "bg-current/15" : "hover:bg-current/10"}`}
            >
              {THEMES[t].label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold"
        >
          <X className="h-3.5 w-3.5" /> Salir
        </button>
      </div>
      <div className="flex-1 overflow-auto px-5 py-8">
        <article className="mx-auto max-w-[68ch] font-serif">
          <h1 className="mb-6 font-bold leading-tight" style={{ fontSize: font.px * 1.3 }}>
            {title}
          </h1>
          <ExcerptText text={text} fontSize={font.px + 2} />
        </article>
      </div>
    </div>
  );
}
