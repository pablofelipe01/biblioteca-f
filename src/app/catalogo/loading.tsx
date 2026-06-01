export default function CatalogoLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <div className="bg-border/60 mb-5 h-8 w-40 animate-pulse rounded-lg" />
      <div className="bg-border/60 mb-6 h-11 w-full animate-pulse rounded-xl" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="bg-card overflow-hidden rounded-2xl border">
            <div className="bg-border/60 aspect-[3/4] w-full animate-pulse" />
            <div className="space-y-2 p-3">
              <div className="bg-border/60 h-4 w-full animate-pulse rounded" />
              <div className="bg-border/60 h-3 w-2/3 animate-pulse rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
