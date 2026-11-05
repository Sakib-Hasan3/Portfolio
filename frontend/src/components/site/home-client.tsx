"use client";

import { useState, useCallback } from "react";
import { AnimatePresence } from "framer-motion";
import type { Project, Publication } from "@/lib/types";
import { ProjectDrawer, ResearchDrawer } from "./detail-drawer";

interface HomeClientProps {
  children: (handlers: {
    onSelectProject: (p: Project) => void;
    onSelectPaper: (p: Publication) => void;
  }) => React.ReactNode;
  authorName?: string;
}

export function HomeClient({ children, authorName }: HomeClientProps) {
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

  return (
    <>
      {children({ onSelectProject, onSelectPaper })}
      <AnimatePresence>
        {selectedProject && (
          <ProjectDrawer
            key={`proj-${selectedProject.id}`}
            project={selectedProject}
            onClose={closeProject}
          />
        )}
        {selectedPaper && (
          <ResearchDrawer
            key={`paper-${selectedPaper.id}`}
            paper={selectedPaper}
            onClose={closePaper}
            authorFallback={authorName}
          />
        )}
      </AnimatePresence>
    </>
  );
}
