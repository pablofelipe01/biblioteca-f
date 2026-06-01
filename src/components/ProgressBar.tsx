export default function ProgressBar({
  value,
  max,
  showLabel = true,
}: {
  value: number;
  max: number;
  showLabel?: boolean;
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-border">
        <div
          className="bg-adventure h-full rounded-full transition-all"
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={max}
        />
      </div>
      {showLabel && (
        <span className="text-muted shrink-0 text-xs font-medium">
          {value}/{max}
        </span>
      )}
    </div>
  );
}
