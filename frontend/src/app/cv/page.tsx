import type { Metadata } from "next";
import Link from "next/link";
import { PrintButton } from "@/components/site/print-button";
import { getPortfolioSafe } from "@/lib/api/server";
import { ieeeCitation } from "@/lib/citation";
import { baseMetadata } from "@/lib/seo";
import { yearSpan } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const data = await getPortfolioSafe();
  const md = baseMetadata(data, { title: `CV — ${data?.profile?.full_name ?? "Portfolio"}`, path: "/cv" });
  return { ...md, robots: { index: false, follow: true } };
}

function H({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-2 mt-6 border-b border-neutral-300 pb-1 font-sans text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-500 break-after-avoid">{children}</h2>;
}

/** CV generated from the same published data as the website, laid out for A4 / Letter. Use "Print / Save as PDF". */
export default async function CvPage() {
  const data = await getPortfolioSafe();
  const p = data?.profile;
  if (!data || !p) return <p className="p-10">CV unavailable.</p>;
  const links = data.social_links.filter((l) => !l.url.startsWith("mailto:"));
  const skills = data.skills.filter((c) => c.skills.length);
  return (
    <div className="cv-sheet min-h-dvh bg-neutral-200 py-8 text-neutral-900 print:bg-white print:py-0">
      <style>{`@page { size: A4; margin: 14mm 14mm; } @media print { html, body { background: #fff !important; } .cv-paper { box-shadow: none !important; margin: 0 !important; padding: 0 !important; max-width: none !important; } } .cv-sheet { color-scheme: light; font-family: var(--font-sans); } .cv-sheet li, .cv-sheet h3 { break-inside: avoid; }`}</style>
      <div className="mx-auto mb-4 flex max-w-[210mm] items-center justify-between px-4 print:hidden">
        <Link href="/" className="text-sm text-neutral-600 hover:text-neutral-900">← {p.full_name}</Link>
        <PrintButton />
      </div>
      <main className="cv-paper mx-auto max-w-[210mm] bg-white px-[14mm] py-[14mm] text-[10.5pt] leading-[1.45] shadow-xl">
        <header>
          <h1 className="font-display text-[26pt] font-bold leading-none tracking-tight">{p.full_name}</h1>
          <p className="mt-1.5 text-[12pt] text-neutral-700">{p.title}{p.specialties.length ? ` · ${p.specialties.join(" · ")}` : ""}</p>
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-0.5 text-[9.5pt] text-neutral-600">
            {p.email && <span>{p.email}</span>}
            {p.phone && <span>{p.phone}</span>}
            {p.location && <span>{p.location}</span>}
            {links.map((l) => <a key={l.id} href={l.url} className="underline decoration-neutral-300">{l.label}: {l.url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}</a>)}
          </p>
        </header>

        {p.about_summary && (<><H>Profile</H><p className="whitespace-pre-line">{p.about_summary}</p></>)}

        {data.education.length > 0 && (<><H>Education</H>
          <ul className="space-y-2">{data.education.map((e) => (
            <li key={e.id}><div className="flex justify-between gap-4"><strong>{e.degree}{e.field_of_study ? `, ${e.field_of_study}` : ""}</strong><span className="shrink-0 text-neutral-600">{yearSpan(e.start_year, e.end_year)}{e.is_expected ? " (expected)" : ""}</span></div>
              <div className="text-neutral-700">{e.institution}{e.location ? `, ${e.location}` : ""}{e.grade ? ` — ${e.grade}` : ""}</div></li>))}</ul></>)}

        {data.publications.length > 0 && (<><H>Publications</H>
          <ol className="list-decimal space-y-1.5 pl-5">{data.publications.map((x) => <li key={x.id}>{ieeeCitation(x, p.full_name)}</li>)}</ol></>)}

        {data.experience.length > 0 && (<><H>Experience &amp; leadership</H>
          <ul className="space-y-3">{data.experience.map((x) => (
            <li key={x.id}><div className="flex justify-between gap-4"><strong>{x.role}</strong><span className="shrink-0 text-neutral-600">{yearSpan(x.start_year, x.end_year, x.is_current)}</span></div>
              <div className="text-neutral-700">{x.organization}{x.location ? `, ${x.location}` : ""}</div>
              {x.highlights.length > 0 && <ul className="mt-1 list-disc space-y-0.5 pl-5">{x.highlights.map((h, i) => <li key={i}>{h}</li>)}</ul>}</li>))}</ul></>)}

        {data.projects.length > 0 && (<><H>Projects</H>
          <ul className="space-y-2.5">{data.projects.map((x) => (
            <li key={x.id}><div className="flex justify-between gap-4"><strong>{x.title}</strong><span className="shrink-0 text-neutral-600">{x.period_label || x.year || ""}</span></div>
              <div>{x.short_description}</div>
              {x.technologies.length > 0 && <div className="text-[9.5pt] text-neutral-600">{x.technologies.join(" · ")}</div>}</li>))}</ul></>)}

        {skills.length > 0 && (<><H>Skills</H>
          <dl className="space-y-1">{skills.map((c) => (
            <div key={c.id} className="grid grid-cols-[9.5rem_1fr] gap-3"><dt className="font-semibold">{c.name}</dt><dd className="text-neutral-700">{c.skills.map((s) => s.name).join(", ")}</dd></div>))}</dl></>)}

        {data.achievements.length > 0 && (<><H>Achievements</H>
          <ul className="list-disc space-y-1 pl-5">{data.achievements.map((a) => <li key={a.id}><strong>{a.title}</strong>{a.issuer ? `, ${a.issuer}` : ""}{a.year ? ` (${a.year})` : ""}</li>)}</ul></>)}
      </main>
    </div>
  );
}
