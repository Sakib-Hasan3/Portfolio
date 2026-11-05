import Link from "next/link";

export default function NotFound() {
  return (
    <main className="container-x flex min-h-dvh flex-col justify-center py-24">
      <p className="font-display text-[clamp(5rem,18vw,11rem)] font-semibold leading-none tracking-[-0.05em] text-line-strong">404</p>
      <h1 className="mt-6 text-3xl md:text-4xl">This page isn&apos;t here</h1>
      <p className="mt-4 max-w-md text-muted">
        The link may be old, or the project may have been renamed. The home page has everything that&apos;s currently published.
      </p>
      <div className="mt-8 flex gap-3">
        <Link href="/" className="btn btn-primary">Go to the home page</Link>
        <Link href="/projects" className="btn btn-ghost">See all projects</Link>
      </div>
    </main>
  );
}
