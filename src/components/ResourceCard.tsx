import Link from "next/link";
import BookCover from "@/components/BookCover";
import type { Resource } from "@/lib/types";
import { Users, BookMarked } from "lucide-react";

const DIVERSITY: { key: keyof Resource; label: string; emoji: string }[] = [
  { key: "tag_ethnicity", label: "Etnia", emoji: "🪶" },
  { key: "tag_afro", label: "Afro", emoji: "✊🏿" },
  { key: "tag_women", label: "Mujeres", emoji: "♀️" },
  { key: "tag_disability", label: "Discapacidad", emoji: "♿" },
];

export default function ResourceCard({ resource }: { resource: Resource }) {
  return (
    <Link
      href={`/catalogo/${resource.id}`}
      className="bg-card group flex flex-col overflow-hidden rounded-2xl border transition hover:border-brand hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
    >
      <div className="aspect-[3/4] w-full overflow-hidden bg-background">
        <BookCover
          title={resource.title}
          author={resource.author}
          isbn={resource.isbn}
          coverUrl={resource.cover_url}
          className="transition group-hover:scale-105"
        />
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <h3 className="line-clamp-2 font-semibold leading-snug">
          {resource.title}
        </h3>
        {resource.author && (
          <p className="text-muted line-clamp-1 text-xs">{resource.author}</p>
        )}

        <div className="flex flex-wrap gap-1.5">
          {resource.genre && (
            <span className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-medium text-brand">
              <BookMarked className="h-3 w-3" />
              {resource.genre}
            </span>
          )}
          {resource.reading_experience && (
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-2/10 px-2 py-0.5 text-[11px] font-medium text-brand-2">
              <Users className="h-3 w-3" />
              {resource.reading_experience}
            </span>
          )}
        </div>

        {resource.synopsis && (
          <p className="text-muted line-clamp-3 text-xs leading-relaxed">
            {resource.synopsis}
          </p>
        )}

        <div className="mt-auto flex gap-1 pt-1">
          {DIVERSITY.filter((d) => resource[d.key]).map((d) => (
            <span key={d.label} title={d.label} aria-label={d.label}>
              {d.emoji}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}
