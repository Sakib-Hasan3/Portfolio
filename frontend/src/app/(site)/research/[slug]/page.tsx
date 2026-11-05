import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, FileText } from "lucide-react";
import { CiteBox } from "@/components/site/cite-box";
import { PaperStack } from "@/components/site/paper-stack";
import { ProjectCard } from "@/components/site/projects";
import { getPortfolioSafe, getPublication, NotFoundError, siteUrl } from "@/lib/api/server";
import { bibtex, ieeeCitation, venueYear } from "@/lib/citation";
import { baseMetadata, jsonLdString } from "@/lib/seo";
import type { Publication } from "@/lib/types";

type Props = { params: Promise<{ slug: string }> };

async function load(slug: string): Promise<Publication | null> {
  try {
    return await getPublication(slug);
  } catch (e) {
    if (e instanceof NotFoundError) return null;
    throw e;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [pub, data] = await Promise.all([load(slug), getPortfolioSafe()]);
  if (!pub) return { title: "Publication not found" };
  return baseMetadata(data, {
    title: `${pub.title} — ${data?.profile?.full_name ?? "Research"}`,
    description: pub.abstract?.slice(0, 300) || `${pub.venue}, ${pub.year}`,
    path: `/research/${pub.slug}`,
  });
}

export default async function PublicationPage({ params }: Props) {
  const { slug } = await params;
  const pub = await load(slug);
  if (!pub) notFound();
  const data = await getPortfolioSafe();
  const author = data?.profile?.full_name;
  const related = (data?.projects ?? []).filter((p) => p.publication?.id === pub.id);
  const others = (data?.publications ?? []).filter((p) => p.id !== pub.id);
  const base = siteUrl(data?.settings?.site_url);

  const ld = {
    "@context": "https://schema.org",
    "@type": "ScholarlyArticle",
    headline: pub.title,
    abstract: pub.abstract ?? undefined,
    datePublished: String(pub.year),
    author: { "@type": "Person", name: author, url: base },
    publisher: { "@type": "Organization", name: pub.venue },
    sameAs: pub.doi_url ?? undefined,
    keywords: pub.tags.join(", ") || undefined,
    url: `${base}/research/${pub.slug}`,
  };

  const facts = [
    { label: "Published in", value: pub.venue },
    { label: "Year", value: String(pub.year) },
    { label: "Type", value: pub.publication_type[0].toUpperCase() + pub.publication_type.slice(1) + " paper" },
    { label: "Authorship", value: pub.author_position },
  ].filter((f) => f.value);

  return (
    <article className="container-x py-12 md:py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(ld) }} />
      <Link href="/research" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-text">
        <ArrowLeft className="size-4" aria-hidden /> Research &amp; publications
      </Link>

      <header className="mt-8 grid items-center gap-10 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <h1 className="text-[clamp(2rem,4.4vw,3.25rem)] leading-[1.05]">{pub.title}</h1>
          <p className="mt-5 text-lg text-muted">
            <span className="text-text">{venueYear(pub.venue, pub.year)}</span>
            {pub.author_position ? ` — ${pub.author_position}` : ""}
          </p>
          {pub.authors && <p className="mt-1 text-muted">{pub.authors}</p>}
          <div className="mt-8 flex flex-wrap gap-3">
            {pub.doi_url && (
              <a href={pub.doi_url} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
                <ExternalLink className="size-4" aria-hidden /> {pub.doi?.startsWith("10.1109/") ? "Read on IEEE Xplore" : "Open via DOI"}
              </a>
            )}
            {pub.pdf_url && (
              <a href={pub.pdf_url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">
                <FileText className="size-4" aria-hidden /> Download PDF
              </a>
            )}
            {pub.external_url && (
              <a href={pub.external_url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">
                <ExternalLink className="size-4" aria-hidden /> Publisher page
              </a>
            )}
          </div>
          {pub.doi && <p className="mt-4 break-all text-sm text-faint">DOI: {pub.doi}</p>}
        </div>
        <div className="lg:col-span-5">
          <PaperStack pub={pub} author={author} />
        </div>
      </header>

      <div className="mt-16 grid gap-12 lg:grid-cols-12">
        <div className="space-y-12 lg:col-span-8">
          {pub.abstract && (
            <section>
              <h2 className="text-2xl">Abstract</h2>
              <p className="mt-4 max-w-[68ch] text-lg leading-relaxed text-muted">{pub.abstract}</p>
            </section>
          )}
          {pub.highlights.length > 0 && (
            <section>
              <h2 className="text-2xl">Key contributions</h2>
              <ol className="mt-5 space-y-4">
                {pub.highlights.map((h, i) => (
                  <li key={i} className="grid max-w-[68ch] grid-cols-[2rem_1fr] gap-2">
                    <span className="font-display text-lg text-accent">{i + 1}</span>
                    <span className="text-muted">{h}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}
          {pub.pdf_url && (
            <section>
              <h2 className="text-2xl">Read the paper</h2>
              <div className="mt-5 overflow-hidden rounded-xl border border-line bg-surface">
                <iframe src={pub.pdf_url} title={`${pub.title} (PDF)`} className="h-[80vh] w-full" loading="lazy" />
              </div>
            </section>
          )}
          <section>
            <h2 className="text-2xl">Cite this paper</h2>
            <div className="mt-5">
              <CiteBox ieee={ieeeCitation(pub, author)} bib={bibtex(pub, author)} />
            </div>
          </section>
        </div>

        <aside className="space-y-8 lg:col-span-4">
          <dl className="overflow-hidden rounded-xl border border-line bg-line">
            {facts.map((f) => (
              <div key={f.label} className="mb-px bg-surface p-4 last:mb-0">
                <dt className="text-xs text-faint">{f.label}</dt>
                <dd className="mt-0.5 text-sm font-medium">{f.value}</dd>
              </div>
            ))}
          </dl>
          {pub.tags.length > 0 && (
            <div>
              <h2 className="font-sans text-sm font-semibold tracking-normal text-muted">Topics</h2>
              <ul className="mt-3 flex flex-wrap gap-2">{pub.tags.map((t) => <li key={t} className="chip">{t}</li>)}</ul>
            </div>
          )}
        </aside>
      </div>

      {related.length > 0 && (
        <section className="mt-20 border-t border-line pt-12">
          <h2 className="text-2xl">Built from this research</h2>
          <div className="mt-6 grid gap-6 md:grid-cols-2">{related.map((p) => <ProjectCard key={p.id} project={p} />)}</div>
        </section>
      )}

      {others.length > 0 && (
        <section className="mt-20 border-t border-line pt-12">
          <h2 className="text-2xl">Other publications</h2>
          <ul className="mt-6 divide-y divide-line border-y border-line">
            {others.map((o) => (
              <li key={o.id}>
                <Link href={`/research/${o.slug}`} className="group grid gap-1 py-5 sm:grid-cols-[1fr_auto] sm:items-baseline sm:gap-6">
                  <span className="font-display text-lg leading-snug group-hover:text-accent">{o.title}</span>
                  <span className="text-sm text-faint">{venueYear(o.venue, o.year)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
