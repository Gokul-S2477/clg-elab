import { apiGet, apiPut } from "./api";

const STORAGE_KEY = "content-studio-workspace";
const CONTENT_STUDIO_EVENT = "content-studio-updated";

const baseWorkspace = () => ({
  announcements: [
    {
      id: "announce-1",
      title: "Resume Builder live",
      message: "Students can now create ATS-friendly resumes directly from the dashboard.",
      audience: "all",
      updatedAt: new Date().toISOString(),
    },
  ],
  modules: [
    {
      id: "sql-study",
      title: "SQL Study Module",
      status: "published",
      owner: "Academics",
      version: "v1.0",
      learnerCountHint: "Core database module",
      topics: 86,
      description: "Detailed SQL learning path with module-based navigation, examples, visuals, and practice.",
      updatedAt: new Date().toISOString(),
    },
    {
      id: "practice-arena",
      title: "Practice Arena",
      status: "published",
      owner: "Placements",
      version: "v1.0",
      learnerCountHint: "73 guided questions",
      topics: 73,
      description: "Coding and SQL practice workspace with progress tracking and protected flows.",
      updatedAt: new Date().toISOString(),
    },
    {
      id: "resume-builder",
      title: "Resume Builder",
      status: "published",
      owner: "Career Services",
      version: "v1.0",
      learnerCountHint: "3 ATS templates + checker",
      topics: 3,
      description: "ATS-friendly resume builder with templates, preview, and profile-based prefill.",
      updatedAt: new Date().toISOString(),
    },
  ],
  versions: [
    {
      id: "ver-initial",
      label: "Initial premium rollout",
      notes: "Unified study, practice, dashboard, and resume experiences.",
      createdAt: new Date().toISOString(),
    },
  ],
});

export const readContentStudioWorkspace = () => {
  if (typeof window === "undefined") return baseWorkspace();
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}");
    return {
      ...baseWorkspace(),
      ...parsed,
      announcements: Array.isArray(parsed.announcements) ? parsed.announcements : baseWorkspace().announcements,
      modules: Array.isArray(parsed.modules) ? parsed.modules : baseWorkspace().modules,
      versions: Array.isArray(parsed.versions) ? parsed.versions : baseWorkspace().versions,
    };
  } catch {
    return baseWorkspace();
  }
};

export const fetchContentStudioWorkspaceFromApi = async () => {
  const payload = await apiGet('/app/content/content-studio');
  return {
    ...baseWorkspace(),
    ...(payload?.data || {}),
  };
};

export const saveContentStudioWorkspaceToApi = async (workspace) => {
  const payload = await apiPut('/app/content/content-studio', workspace);
  return {
    ...baseWorkspace(),
    ...(payload?.data || {}),
  };
};

export const saveContentStudioWorkspace = (workspace) => {
  if (typeof window === "undefined") return baseWorkspace();
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
  window.dispatchEvent(new CustomEvent(CONTENT_STUDIO_EVENT, { detail: workspace }));
  return workspace;
};

export const exportContentStudioWorkspace = () => JSON.stringify(readContentStudioWorkspace(), null, 2);

export const importContentStudioWorkspace = (rawValue) => {
  const parsed = JSON.parse(rawValue);
  return saveContentStudioWorkspace({
    ...baseWorkspace(),
    ...parsed,
  });
};

export const addContentStudioVersion = (workspace, notes) => ({
  ...workspace,
  versions: [
    {
      id: `ver-${Date.now()}`,
      label: `Revision ${workspace.versions.length + 1}`,
      notes,
      createdAt: new Date().toISOString(),
    },
    ...workspace.versions,
  ].slice(0, 12),
});

export const getContentStudioEventName = () => CONTENT_STUDIO_EVENT;
