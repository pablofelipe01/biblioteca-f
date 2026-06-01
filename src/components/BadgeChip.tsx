export default function BadgeChip({
  name,
  description,
  icon,
  earned = true,
  size = "md",
}: {
  name: string;
  description?: string | null;
  icon?: string | null;
  earned?: boolean;
  size?: "sm" | "md";
}) {
  return (
    <div
      title={description ?? name}
      className={`flex items-center gap-2 rounded-2xl border p-3 transition ${
        earned ? "bg-card" : "bg-background opacity-50 grayscale"
      }`}
    >
      <span className={size === "md" ? "text-3xl" : "text-2xl"}>
        {icon ?? "🏅"}
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{name}</p>
        {description && (
          <p className="text-muted truncate text-xs">{description}</p>
        )}
      </div>
    </div>
  );
}
