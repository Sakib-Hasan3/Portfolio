import type { Metadata } from "next";
import Link from "next/link";
import { ContactSection } from "@/components/site/contact";
import { Hero } from "@/components/site/hero";
import { HomeClient } from "@/components/site/home-client";
import { FeaturedProjects } from "@/components/site/projects";
import { PublicationList } from "@/components/site/research";
import { Section } from "@/components/site/section";
import { About, Achievements, EducationList, ExperienceTimeline, Skills } from "@/components/site/sections";
import { ContentUnavailable } from "@/components/site/states";
import { getPortfolioSafe } from "@/lib/api/server";
import { baseMetadata, jsonLdString, personJsonLd } from "@/lib/seo";
import { isVisible } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const data = await getPortfolioSafe();
  return baseMetadata(data, { image: data?.settings?.og_image_url || undefined });
}

export default async function HomePage() {
  const data = await getPortfolioSafe();
  if (!data || !data.profile) return <ContentUnavailable />;
  const vis = data.settings?.section_visibility;
  const ld = personJsonLd(data);
  const authorName = data.profile.full_name;

  return (
    <>
      {ld && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(ld) }} />}
      <Hero data={data} />
      <HomeClient authorName={authorName}>
        {({ onSelectProject, onSelectPaper }) => (
          <>
            {isVisible(vis, "about") && data.profile!.about_summary && <About data={data} />}
            {isVisible(vis, "research") && data.publications.length > 0 && (
              <Section
                id="research"
                title="Research & publications"
                lede="Peer-reviewed work, with links to the published versions."
                aside={<Link href="/research" className="mt-6 inline-block text-sm text-accent hover:underline">Open the research page</Link>}
              >
                <PublicationList items={data.publications} onSelect={onSelectPaper} />
              </Section>
            )}
            {isVisible(vis, "projects") && data.projects.length > 0 && (
              <Section
                id="projects"
                title="Selected projects"
                lede="Systems I've designed and built, from research prototypes to full-stack products."
                aside={
                  <Link href="/projects" className="btn btn-ghost mt-6">
                    Browse all {data.projects.length} projects
                  </Link>
                }
              >
                <FeaturedProjects projects={data.projects} onSelect={onSelectProject} />
              </Section>
            )}
            {isVisible(vis, "skills") && <Skills categories={data.skills} />}
            {isVisible(vis, "experience") && <ExperienceTimeline items={data.experience} />}
            {isVisible(vis, "education") && <EducationList items={data.education} />}
            {isVisible(vis, "achievements") && <Achievements items={data.achievements} />}
            {isVisible(vis, "contact") && (
              <ContactSection profile={data.profile!} links={data.social_links} enabled={data.settings?.contact_form_enabled ?? true} />
            )}
          </>
        )}
      </HomeClient>
    </>
  );
}
