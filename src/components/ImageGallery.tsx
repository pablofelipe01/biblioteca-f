"use client";

import { useState } from "react";
import { X } from "lucide-react";

/** Miniaturas que se amplían al tocarlas. */
export default function ImageGallery({
  images,
  size = "md",
}: {
  images: { path: string; url: string }[];
  size?: "sm" | "md" | "lg";
}) {
  const [open, setOpen] = useState<string | null>(null);
  if (images.length === 0) return null;

  const thumb =
    size === "sm" ? "h-14 w-14" : size === "lg" ? "h-40 w-full sm:w-56" : "h-24 w-24";

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {images.map((img) => (
          <button
            key={img.path}
            type="button"
            onClick={() => setOpen(img.url)}
            className={`${thumb} overflow-hidden rounded-xl border bg-background transition hover:border-brand`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- URL firmada */}
            <img src={img.url} alt="Imagen adjunta" className="h-full w-full object-cover" />
          </button>
        ))}
      </div>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setOpen(null)}
        >
          <button
            type="button"
            onClick={() => setOpen(null)}
            className="absolute right-4 top-4 rounded-full bg-white/20 p-2 text-white hover:bg-white/30"
            title="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element -- URL firmada */}
          <img
            src={open}
            alt="Imagen ampliada"
            className="max-h-[90vh] max-w-full rounded-xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
