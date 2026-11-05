import type { Metadata } from "next";
import { Suspense } from "react";
import { ProjectExplorer } from "@/components/site/project-explorer";
import { ContentUnavailable } from "@/components/site/states";
import { getPortfolioSafe } from "@/lib/api/server";
import { getT } from "@/lib/i18n-server";
import { baseMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const data = await getPortfolioSafe();
  const name = data?.profile?.full_name ?? "Portfolio";
  return baseMetadata(data, {
    title: `Projects — ${name}`,
    description: `Machine learning, computer vision, NLP and full-stack projects by ${name}.`,
    path: "/projects",
  });
}

export default async function ProjectsPage() {
  const [data, { t }] = await Promise.all([getPortfolioSafe(), getT()]);
  if (!data) return <ContentUnavailable />;
  return (
    <div className="container-x py-14 md:py-20">
      <h1 className="text-4xl md:text-5xl">{t("projects.title")}</h1>
      <p className="mt-4 max-w-xl text-muted">{t("projects.lede")}</p>
      <div className="mt-12">
        <Suspense>
          <ProjectExplorer projects={data.projects} />
        </Suspense>
      </div>
    </div>
  );
}
