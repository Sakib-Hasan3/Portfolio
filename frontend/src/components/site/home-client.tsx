"use client";

import Link from "next/link";
import { useState, useCallback } from "react";
import { AnimatePresence } from "framer-motion";
import type { Portfolio, Project, Publication } from "@/lib/types";
import { useT } from "@/components/i18n-provider";
import { isVisible } from "@/lib/utils";
import { ContactSection } from "./contact";
import { ProjectDrawer, ResearchDrawer } from "./detail-drawer";
import { FeaturedProjects } from "./projects";
import { PublicationList } from "./research";
import { NotesPreview } from "./notes";
import { Section } from "./section";
import { Testimonials } from "./testimonials";
import { About, Achievements, EducationList, ExperienceTimeline, Skills } from "./sections";

/**
 * Home page body. It lives in a client component because the project/paper cards open detail drawers;
 * it receives plain serialisable data from the server page (a render-prop child cannot cross that boundary).
 */
export function HomeClient({ data }: { data: Portfolio }) {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedPaper, setSelectedPaper] = useState<Publication | null>(null);

  const onSelectProject = useCallback((p: Project) => {
    setSelectedPaper(null);
    setSelectedProject(p);
  }, []);
  const onSelectPaper = useCallback((p: Publication) => {
    setSelectedProject(null);
    setSelectedPaper(p);
  }, []);
  const closeProject = useCallback(() => setSelectedProject(null), []);
  const closePaper = useCallback(() => setSelectedPaper(null), []);

  const t = useT();
  const vis = data.settings?.section_visibility;
  const profile = data.profile!;

  return (
    <>
      {isVisible(vis, "about") && profile.about_summary && <About data={data} />}
      {isVisible(vis, "research") && data.publications.length > 0 && (
        <Section
          id="research"
          title={t("sec.research")}
          lede={t("sec.research.lede")}
          aside={<Link href="/research" className="mt-6 inline-block text-sm text-accent hover:underline">{t("sec.research.more")}</Link>}
        >
          <PublicationList items={data.publications} onSelect={onSelectPaper} />
        </Section>
      )}
      {isVisible(vis, "projects") && data.projects.length > 0 && (
        <Section
          id="projects"
          title={t("sec.projects")}
          lede={t("sec.projects.lede")}
          aside={
            <Link href="/projects" className="btn btn-ghost mt-6">
              {t("sec.projects.all", { n: data.projects.length })}
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
      {isVisible(vis, "testimonials") && <Testimonials items={data.testimonials ?? []} />}
      {isVisible(vis, "notes") && <NotesPreview notes={data.notes ?? []} />}
      {isVisible(vis, "contact") && (
        <ContactSection profile={profile} links={data.social_links} enabled={data.settings?.contact_form_enabled ?? true} />
      )}

      <AnimatePresence>
        {selectedProject && <ProjectDrawer key={`proj-${selectedProject.id}`} project={selectedProject} onClose={closeProject} />}
        {selectedPaper && (
          <ResearchDrawer key={`paper-${selectedPaper.id}`} paper={selectedPaper} onClose={closePaper} authorFallback={profile.full_name} />
        )}
      </AnimatePresence>
    </>
  );
}
