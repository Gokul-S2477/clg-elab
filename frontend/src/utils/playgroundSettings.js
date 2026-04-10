const PLAYGROUND_SETTINGS_KEY = "playground-settings";

export const DEFAULT_PLAYGROUND_SETTINGS = {
  compilerEnabled: true,
  appEnabled: true,
  sqlEnabled: true,
  notebookEnabled: true,
  studyLockMode: true,
  showSchemaDiagrams: true,
  enableSqlHistory: true,
  sqlPageSize: 100,
  maxNotebookCells: 20,
  compactSqlSidebar: false,
  sqlTableDenseMode: false,
  autoRunLastSqlOnDatasetChange: false,
  keepNotebookOutputsOnLanguageSwitch: false,
};

export const getPlaygroundSettings = () => {
  if (typeof window === "undefined") return DEFAULT_PLAYGROUND_SETTINGS;
  try {
    const stored = JSON.parse(localStorage.getItem(PLAYGROUND_SETTINGS_KEY) || "{}");
    return {
      ...DEFAULT_PLAYGROUND_SETTINGS,
      ...stored,
    };
  } catch {
    return DEFAULT_PLAYGROUND_SETTINGS;
  }
};

export const savePlaygroundSettings = (nextSettings) => {
  if (typeof window === "undefined") return DEFAULT_PLAYGROUND_SETTINGS;
  const next = {
    ...DEFAULT_PLAYGROUND_SETTINGS,
    ...nextSettings,
  };
  localStorage.setItem(PLAYGROUND_SETTINGS_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent("playground-settings-updated", { detail: next }));
  return next;
};
