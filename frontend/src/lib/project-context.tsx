"use client";

import { createContext, useContext, useEffect, useMemo, useState, ReactNode, useCallback } from "react";
import { apiFetch } from "./api";
import { Project } from "./types";
import { useAuth } from "./auth-context";

interface ProjectContextValue {
  projects: Project[];
  currentProjectId: string | null;
  currentProject: Project | null;
  setCurrentProjectId: (id: string) => void;
  loading: boolean;
  refresh: () => Promise<void>;
}

const ProjectContext = createContext<ProjectContextValue | undefined>(undefined);

const STORAGE_KEY = "parking:currentProjectId";

export function ProjectProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProjectId, setCurrentProjectIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setProjects([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await apiFetch<{ projects: Project[] }>("/api/projects");
      setProjects(data.projects);

      if (user.role === "SUPER_ADMIN") {
        const stored = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
        const stillExists = data.projects.find((p) => p._id === stored);
        setCurrentProjectIdState(stillExists ? stored : data.projects[0]?._id ?? null);
      } else {
        setCurrentProjectIdState(user.projectId ?? data.projects[0]?._id ?? null);
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const setCurrentProjectId = useCallback((id: string) => {
    setCurrentProjectIdState(id);
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, id);
  }, []);

  const currentProject = useMemo(
    () => projects.find((p) => p._id === currentProjectId) ?? null,
    [projects, currentProjectId]
  );

  return (
    <ProjectContext.Provider
      value={{ projects, currentProjectId, currentProject, setCurrentProjectId, loading, refresh: load }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject(): ProjectContextValue {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error("useProject must be used within a ProjectProvider");
  return ctx;
}
