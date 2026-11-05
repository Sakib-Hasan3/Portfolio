import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BookOpen, ExternalLink } from "lucide-react";
import { GitHubIcon } from "@/components/site/icons";
import { ProjectStage } from "@/components/site/project-stage";
import { ProjectCard } from "@/components/site/projects";
import { RichText } from "@/components/site/sections";
import { getPortfolioSafe, getProject, NotFoundError } from "@/lib/api/server";
import { venueYear } from "@/lib/citation";
import { baseMetadata } from "@/lib/seo";
import type { Project } from "@/lib/types";
import { STATUS_LABEL } from "@/lib/utils";

type Props = { params: Promise<{ slug: string }> };

async function load(slug: string): Promise<Project | null> {
  try {
    return await getProject(slug);
  } catch (e) {
    if (e instanceof NotFoundError) return null;
    throw e;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [project, data] = await Promise.all([load(slug), getPortfolioSafe()]);
  if (!project) return { title: "Project not found" };
  return baseMetadata(data, {
    title: `${project.title} — ${data?.profile?.full_name ?? "Project"}`,
    description: project.short_description,
    path: `/projects/${project.slug}`,
    image: project.thumbnail_url,
  });
}

export default async function ProjectPage({ params }: Props) {
  const { slug } = await params;
  const project = await load(slug);
  if (!project) notFound();
  const data = await getPortfolioSafe();
  const others = (data?.projects ?? []).filter((p) => p.id !== project.id).slice(0, 2);

  const facts = [
    { label: "Year", value: project.period_label || (project.year ? String(project.year) : null) },
    { label: "Area", value: project.category },
    { label: "Status", value: STATUS_LABEL[project.status] ?? project.status },
  ].filter((f) => f.value);

  return (
    <article className="container-x py-12 md:py-16">
      <Link href="/projects" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-text">
        <ArrowLeft className="size-4" aria-hidden /> All projects
      </Link>

      <header className="mt-8 grid gap-10 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <h1 className="text-[clamp(2.25rem,5vw,3.5rem)] leading-[1.02]">{project.title}</h1>
          <p className="mt-5 max-w-[60ch] text-lg text-muted">{project.short_description}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            {project.github_url && (
              <a href={project.github_url} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
                <GitHubIcon className="size-4" /> View source
              </a>
            )}
            {project.demo_url && (
              <a href={project.demo_url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">
                <ExternalLink className="size-4" aria-hidden /> Live demo
              </a>
            )}
            {project.extra_links.map((l) => (
              <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">
                <ExternalLink className="size-4" aria-hidden /> {l.label}
              </a>
            ))}
          </div>
        </div>
        <dl className="grid h-fit grid-cols-3 gap-px overflow-hidden rounded-xl border border-line bg-line lg:col-span-4 lg:grid-cols-1">
          {facts.map((f) => (
            <div key={f.label} className="bg-surface p-4">
              <dt className="text-xs text-faint">{f.label}</dt>
              <dd className="mt-0.5 text-sm font-medium">{f.value}</dd>
            </div>
          ))}
        </dl>
      </header>

      {project.thumbnail_url && <ProjectStage src={project.thumbnail_url} alt={`${project.title} preview`} />}

      <div className="mt-14 grid gap-12 lg:grid-cols-12">
        <div className="space-y-10 lg:col-span-8">
          {project.description && (
            <section>
              <h2 className="text-2xl">Overview</h2>
              <RichText text={project.description} className="mt-4 max-w-[68ch] text-muted" />
            </section>
          )}
          {project.highlights.length > 0 && (
            <section>
              <h2 className="text-2xl">What I built</h2>
              <ul className="mt-4 max-w-[68ch] list-disc space-y-2 pl-5 text-muted marker:text-faint">
                {project.highlights.map((h, i) => <li key={i}>{h}</li>)}
              </ul>
            </section>
          )}
          {project.images.length > 0 && (
            <section>
              <h2 className="text-2xl">Screenshots</h2>
              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                {project.images.map((img) => (
                  <figure key={img.id} className="overflow-hidden rounded-xl border border-line bg-surface">
                    <a href={img.url} target="_blank" rel="noopener noreferrer">
                      <img src={img.url} alt={img.caption || `${project.title} screenshot`} loading="lazy" className="w-full" />
                    </a>
                    {img.caption && <figcaption className="px-4 py-3 text-sm text-muted">{img.caption}</figcaption>}
                  </figure>
                ))}
              </div>
            </section>
          )}
        </div>
        <aside className="space-y-8 lg:col-span-4">
          <div>
            <h2 className="font-sans text-sm font-semibold tracking-normal text-muted">Technologies</h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {project.technologies.map((t) => <li key={t} className="chip">{t}</li>)}
            </ul>
          </div>
          {project.publication && (
            <div className="rounded-xl border border-line bg-surface p-5">
              <h2 className="flex items-center gap-2 font-sans text-sm font-semibold tracking-normal text-muted">
                <BookOpen className="size-4" aria-hidden /> Related publication
              </h2>
              <Link href={`/research/${project.publication.slug}`} className="mt-2 block font-display text-lg leading-snug hover:text-accent">
                {project.publication.title}
              </Link>
              <p className="mt-1 text-sm text-muted">{venueYear(project.publication.venue, project.publication.year)}</p>
              {project.publication.doi && (
                <a href={`https://doi.org/${project.publication.doi}`} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block break-all text-sm text-accent hover:underline">
                  doi:{project.publication.doi}
                </a>
              )}
            </div>
          )}
        </aside>
      </div>

      {others.length > 0 && (
        <section className="mt-20 border-t border-line pt-12">
          <h2 className="text-2xl">More projects</h2>
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            {others.map((p) => <ProjectCard key={p.id} project={p} />)}
          </div>
        </section>
      )}
    </article>
  );
}
