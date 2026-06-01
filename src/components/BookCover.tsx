"use client";

import { useState } from "react";

/**
 * Portada del libro. Orden de preferencia:
 *  1) cover_url explícito
 *  2) Open Library por ISBN (si 404, cae al placeholder)
 *  3) placeholder generado con título + autor
 */
export default function BookCover({
  title,
  author,
  isbn,
  coverUrl,
  className = "",
}: {
  title: string;
  author?: string | null;
  isbn?: string | null;
  coverUrl?: string | null;
  className?: string;
}) {
  const cleanIsbn = isbn?.replace(/[^0-9Xx]/g, "") || null;
  const initial =
    coverUrl ||
    (cleanIsbn
      ? `https://covers.openlibrary.org/b/isbn/${cleanIsbn}-M.jpg?default=false`
      : null);

  const [src, setSrc] = useState<string | null>(initial);

  if (!src) {
    return <Placeholder title={title} author={author} className={className} />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={`Portada de ${title}`}
      loading="lazy"
      onError={() => setSrc(null)}
      className={`h-full w-full object-cover ${className}`}
    />
  );
}

function Placeholder({
  title,
  author,
  className,
}: {
  title: string;
  author?: string | null;
  className?: string;
}) {
  // Color estable derivado del título.
  const hue =
    [...title].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
  return (
    <div
      className={`flex h-full w-full flex-col justify-between p-3 text-white ${className}`}
      style={{
        backgroundImage: `linear-gradient(150deg, hsl(${hue} 70% 45%), hsl(${(hue + 40) % 360} 70% 35%))`,
      }}
    >
      <span className="line-clamp-4 text-sm font-bold leading-tight">
        {title}
      </span>
      {author && (
        <span className="line-clamp-2 text-xs text-white/80">{author}</span>
      )}
    </div>
  );
}
