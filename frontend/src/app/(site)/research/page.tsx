import type { Metadata } from "next";
import { PublicationList } from "@/components/site/research";
import { ContentUnavailable } from "@/components/site/states";
import { getPortfolioSafe } from "@/lib/api/server";
import { baseMetadata, jsonLdString, personJsonLd } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const data = await getPortfolioSafe();
  const name = data?.profile?.full_name ?? "Portfolio";
  return baseMetadata(data, {
    title: `Research & publications — ${name}`,
    description: `Peer-reviewed publications by ${name}.`,
    path: "/research",
  });
}

export default async function ResearchPage() {
  const data = await getPortfolioSafe();
  if (!data) return <ContentUnavailable />;
  const ld = personJsonLd(data);
  const linked = data.projects.filter((p) => p.publication);
  return (
    <div className="container-x py-14 md:py-20">
      {ld && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(ld) }} />}
      <div className="max-w-3xl">
        <h1 className="text-4xl md:text-5xl">Research &amp; publications</h1>
        <p className="mt-4 max-w-xl text-muted">
          Papers I&apos;ve authored, with DOIs for the published versions. Filter by year or type, and copy a citation in IEEE style.
        </p>
      </div>
      <div className="mt-12 max-w-4xl">
        {data.publications.length ? <PublicationList items={data.publications} /> : <p className="text-muted">No publications are listed yet.</p>}
      </div>
      {linked.length > 0 && (
        <p className="mt-10 text-sm text-muted">
          Related implementations:{" "}
          {linked.map((p, i) => (
            <span key={p.id}>
              {i > 0 && ", "}
              <a href={`/projects/${p.slug}`} className="text-accent hover:underline">{p.title}</a>
            </span>
          ))}
        </p>
      )}
    </div>
  );
}
