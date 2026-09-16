"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { IMAGE_BUCKET, MAX_IMAGES, shrinkImage, type ImageFolder } from "@/lib/images";
import { ImagePlus, Loader2, X } from "lucide-react";

export interface UploadedImage {
  path: string;
  /** URL para previsualizar (firmada o blob: local). */
  url: string;
}

/**
 * Sube imágenes al bucket privado y devuelve sus rutas. No borra del Storage al
 * quitar una imagen: así cancelar una edición nunca rompe lo ya guardado.
 */
export default function ImageUploader({
  orgId,
  folder,
  value,
  onChange,
  max = MAX_IMAGES,
  label = "Agregar imagen",
  compact = false,
}: {
  orgId: string;
  folder: ImageFolder;
  value: UploadedImage[];
  onChange: (images: UploadedImage[]) => void;
  max?: number;
  label?: string;
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(files: FileList) {
    setError(null);
    const room = max - value.length;
    const list = [...files].filter((f) => f.type.startsWith("image/")).slice(0, room);
    if (list.length === 0) {
      if (room <= 0) setError(`Máximo ${max} imágenes.`);
      return;
    }
    setUploading(true);
    const supabase = createClient();
    const added: UploadedImage[] = [];
    try {
      for (const file of list) {
        const blob = await shrinkImage(file);
        const ext = blob.type === "image/gif" ? "gif" : blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : "jpg";
        const path = `${orgId}/${folder}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from(IMAGE_BUCKET)
          .upload(path, blob, { contentType: blob.type || "image/jpeg" });
        if (upErr) throw new Error(upErr.message);
        added.push({ path, url: URL.createObjectURL(blob) });
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? `No se pudo subir la imagen: ${e.message}`
          : "No se pudo subir la imagen.",
      );
    } finally {
      if (added.length > 0) onChange([...value, ...added]);
      setUploading(false);
    }
  }

  const thumb = compact ? "h-16 w-16" : "h-24 w-24";

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {value.map((img) => (
          <div key={img.path} className={`relative ${thumb} overflow-hidden rounded-xl border bg-background`}>
            {/* eslint-disable-next-line @next/next/no-img-element -- URL firmada/blob */}
            <img src={img.url} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => onChange(value.filter((v) => v.path !== img.path))}
              title="Quitar imagen"
              className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white hover:bg-danger"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {value.length < max && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className={`${thumb} text-muted flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed text-[11px] font-medium hover:border-brand hover:text-brand disabled:opacity-60`}
          >
            {uploading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <ImagePlus className="h-5 w-5" />
            )}
            <span className="px-1 text-center leading-tight">
              {uploading ? "Subiendo…" : label}
            </span>
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) upload(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
