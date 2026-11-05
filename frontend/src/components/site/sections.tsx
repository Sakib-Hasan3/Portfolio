import { Check, ExternalLink, GraduationCap } from "lucide-react";
import type { Achievement, Education, Experience, Portfolio, SkillCategory } from "@/lib/types";
import { textBlocks, yearSpan } from "@/lib/utils";
import { CategoryIcon } from "./icons";
import { Section } from "./section";

export function RichText({ text, className = "" }: { text: string | null | undefined; className?: string }) {
  const blocks = textBlocks(text);
  return (
    <div className={`space-y-4 ${className}`}>
      {blocks.map((b, i) =>
        b.type === "p" ? (
          <p key={i} className="whitespace-pre-line">
            {b.text}
          </p>
        ) : (
          <ul key={i} className="list-disc space-y-1.5 pl-5 marker:text-faint">
            {b.items.map((it, j) => (
              <li key={j}>{it}</li>
            ))}
          </ul>
        ),
      )}
    </div>
  );
}

export function About({ data }: { data: Portfolio }) {
  const p = data.profile!;
  const facts: { label: string; value: string }[] = [];
  const edu = data.education[0];
  if (edu) facts.push({ label: "Studying", value: `${edu.field_of_study || edu.degree}, ${edu.institution}` });
  const pubs = data.publications;
  if (pubs.length) {
    const ieee = pubs.every((x) => /\bIEEE\b/.test(x.venue)) ? "IEEE " : "";
    facts.push({ label: "Publications", value: `${pubs.length} ${ieee}${pubs.length === 1 ? "paper" : "papers"}` });
  }
  if (data.projects.length) facts.push({ label: "Projects", value: `${data.projects.length} documented here` });
  if (p.location) facts.push({ label: "Based in", value: p.location });

  return (
    <Section id="about" title={p.about_title || "About"}>
      <RichText text={p.about_summary} className="max-w-[65ch] text-lg leading-relaxed" />
      {p.about_highlights.length > 0 && (
        <ul className="mt-10 grid gap-x-8 gap-y-3 sm:grid-cols-2">
          {p.about_highlights.map((h) => (
            <li key={h} className="flex gap-3 text-muted">
              <Check className="mt-1 size-4 shrink-0 text-accent" aria-hidden />
              <span>{h}</span>
            </li>
          ))}
        </ul>
      )}
      {facts.length > 0 && (
        <dl className="mt-12 grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2">
          {facts.map((f) => (
            <div key={f.label} className="bg-surface p-5">
              <dt className="text-sm text-faint">{f.label}</dt>
              <dd className="mt-1 font-medium">{f.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </Section>
  );
}

export function Skills({ categories }: { categories: SkillCategory[] }) {
  if (!categories.length) return null;
  return (
    <Section id="skills" title="Skills" lede="The tools and methods I work with, grouped by area.">
      <div className="divide-y divide-line border-y border-line">
        {categories.map((c) => (
          <div key={c.id} className="grid gap-4 py-6 sm:grid-cols-[14rem_1fr] sm:gap-8">
            <h3 className="flex items-start gap-2.5 font-sans text-[15px] font-semibold tracking-normal">
              <CategoryIcon name={c.icon} className="mt-0.5 size-[18px] shrink-0 text-accent" />
              {c.name}
            </h3>
            <ul className="flex flex-wrap gap-2" aria-label={`${c.name} skills`}>
              {c.skills.map((s) => (
                <li key={s.id} className="chip">
                  {s.name}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Section>
  );
}

export function ExperienceTimeline({ items }: { items: Experience[] }) {
  if (!items.length) return null;
  return (
    <Section id="experience" title="Experience & leadership">
      <ol className="relative border-l border-line pl-8">
        {items.map((e) => (
          <li key={e.id} className="relative pb-12 last:pb-0">
            <span
              className={`absolute -left-[37px] top-1.5 size-[9px] rounded-full ring-4 ring-bg ${e.is_current ? "bg-accent" : "bg-line-strong"}`}
              aria-hidden
            />
            <p className="text-sm text-faint">
              {yearSpan(e.start_year, e.end_year, e.is_current)}
              {e.employment_type ? <span className="text-faint"> — {e.employment_type}</span> : null}
            </p>
            <h3 className="mt-1.5 text-xl">{e.role}</h3>
            <p className="mt-1 text-muted">
              {e.organization}
              {e.location ? `, ${e.location}` : ""}
            </p>
            {e.description ? <RichText text={e.description} className="mt-3 max-w-[65ch] text-muted" /> : null}
            {e.highlights.length > 0 && (
              <ul className="mt-3 max-w-[65ch] list-disc space-y-1.5 pl-5 text-muted marker:text-faint">
                {e.highlights.map((h, i) => (
                  <li key={i}>{h}</li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
    </Section>
  );
}

export function EducationList({ items }: { items: Education[] }) {
  if (!items.length) return null;
  return (
    <Section id="education" title="Education">
      <div className="space-y-6">
        {items.map((e) => (
          <article key={e.id} className="flex gap-5 rounded-xl border border-line bg-surface p-6">
            <GraduationCap className="mt-1 size-6 shrink-0 text-accent" aria-hidden />
            <div className="min-w-0">
              <h3 className="text-xl">
                {e.degree}
                {e.field_of_study ? ` in ${e.field_of_study}` : ""}
              </h3>
              <p className="mt-1 text-muted">
                {e.institution}
                {e.location ? `, ${e.location}` : ""}
              </p>
              <p className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                {e.end_year || e.start_year ? (
                  <span>
                    {e.is_expected ? "Expected graduation " : ""}
                    {e.is_expected ? e.end_year : yearSpan(e.start_year, e.end_year)}
                  </span>
                ) : null}
                {e.grade ? <span className="text-muted">{e.grade}</span> : null}
              </p>
              {e.description ? <RichText text={e.description} className="mt-3 text-muted" /> : null}
              {e.highlights.length > 0 && (
                <ul className="mt-3 list-disc space-y-1 pl-5 text-muted marker:text-faint">
                  {e.highlights.map((h, i) => (
                    <li key={i}>{h}</li>
                  ))}
                </ul>
              )}
            </div>
          </article>
        ))}
      </div>
    </Section>
  );
}

export function Achievements({ items }: { items: Achievement[] }) {
  if (!items.length) return null;
  return (
    <Section id="achievements" title="Achievements">
      <ul className="divide-y divide-line border-y border-line">
        {items.map((a) => (
          <li key={a.id} className="grid gap-2 py-5 sm:grid-cols-[5rem_1fr]">
            <span className="text-sm text-faint">{a.year ?? ""}</span>
            <div>
              <h3 className="font-sans text-base font-semibold tracking-normal">
                {a.url ? (
                  <a href={a.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 hover:text-accent">
                    {a.title} <ExternalLink className="size-3.5" aria-hidden />
                  </a>
                ) : (
                  a.title
                )}
              </h3>
              {a.issuer ? <p className="text-sm text-muted">{a.issuer}</p> : null}
              {a.description ? <p className="mt-2 text-muted">{a.description}</p> : null}
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}
