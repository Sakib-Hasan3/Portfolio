export function ContentUnavailable() {
  return (
    <div className="container-x py-32">
      <h1 className="text-3xl">This page couldn&apos;t load its content</h1>
      <p className="mt-4 max-w-lg text-muted">
        The content service didn&apos;t respond. Refresh in a moment — if it keeps happening, check that the API is running.
      </p>
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="container-x py-16" aria-busy="true" aria-label="Loading">
      <div className="skeleton h-5 w-40" />
      <div className="skeleton mt-6 h-16 w-full max-w-2xl" />
      <div className="skeleton mt-4 h-5 w-full max-w-xl" />
      <div className="skeleton mt-2 h-5 w-full max-w-lg" />
      <div className="mt-16 grid gap-6 md:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="overflow-hidden rounded-2xl border border-line">
            <div className="skeleton aspect-[16/9] rounded-none" />
            <div className="space-y-3 p-6">
              <div className="skeleton h-4 w-24" />
              <div className="skeleton h-6 w-3/4" />
              <div className="skeleton h-4 w-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
