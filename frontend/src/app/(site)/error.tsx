"use client";

export default function SiteError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="container-x py-32">
      <h1 className="text-3xl">This page didn&apos;t load</h1>
      <p className="mt-4 max-w-lg text-muted">Something failed while loading the content. Try again — it usually works on the second attempt.</p>
      <button type="button" onClick={reset} className="btn btn-primary mt-8">
        Try again
      </button>
    </div>
  );
}
