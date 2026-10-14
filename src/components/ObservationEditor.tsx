"use client";

import { useRef, useState, useTransition } from "react";
import { CheckCircle2, Loader2, Save } from "lucide-react";

const EMOJIS = ["👏", "🌟", "💪", "🎉", "👍", "📚", "💡", "🤔", "❤️", "😊", "🚀", "🏆"];

/**
 * Textarea con barra de emoticones que se insertan en la posición del cursor.
 * `children` va a la derecha de la barra (estado y botón de guardar).
 */
export function EmojiTextarea({
  value,
  onChange,
  rows,
  maxLength,
  placeholder,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  rows: number;
  maxLength: number;
  placeholder: string;
  children?: React.ReactNode;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  function insert(emoji: string) {
    const el = ref.current;
    const pos = el?.selectionStart ?? value.length;
    onChange(value.slice(0, pos) + emoji + value.slice(el?.selectionEnd ?? pos));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(pos + emoji.length, pos + emoji.length);
    });
  }

  return (
    <>
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        maxLength={maxLength}
        placeholder={placeholder}
        className="w-full rounded-lg border bg-card px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
      />
      <div className="mt-1 flex flex-wrap items-center gap-1">
        {EMOJIS.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => insert(e)}
            className="rounded-lg px-1.5 py-0.5 text-lg leading-none transition hover:scale-110 hover:bg-card"
            title={`Agregar ${e}`}
          >
            {e}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">{children}</div>
      </div>
    </>
  );
}

/** Observación general (texto + emoticones) con su botón de guardar. */
export default function ObservationEditor({
  initial,
  onSave,
  label,
  placeholder,
  icon,
}: {
  initial: string | null;
  onSave: (text: string) => Promise<void>;
  label: string;
  placeholder: string;
  icon?: React.ReactNode;
}) {
  const [text, setText] = useState(initial ?? "");
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const change = (v: string) => {
    setText(v);
    setSaved(false);
  };

  function save() {
    setError(null);
    start(async () => {
      try {
        await onSave(text);
        setSaved(true);
      } catch {
        setError("No se pudo guardar.");
      }
    });
  }

  return (
    <div>
      <label className="text-muted mb-1 flex items-center gap-1 text-xs font-medium">
        {icon} {label}
      </label>
      <EmojiTextarea
        value={text}
        onChange={change}
        rows={3}
        maxLength={2000}
        placeholder={placeholder}
      >
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
          Guardar observación
        </button>
      </EmojiTextarea>
    </div>
  );
}
