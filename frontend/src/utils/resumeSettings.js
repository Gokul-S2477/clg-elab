import { apiGet, apiPut } from "./api";

const RESUME_SETTINGS_KEY = "resume-builder-settings";

const DEFAULT_RESUME_SETTINGS = {
  studentProfileEditEnabled: true,
};

export const getResumeSettings = () => {
  if (typeof window === "undefined") return DEFAULT_RESUME_SETTINGS;
  try {
    const stored = JSON.parse(localStorage.getItem(RESUME_SETTINGS_KEY) || "{}");
    return { ...DEFAULT_RESUME_SETTINGS, ...stored };
  } catch (error) {
    console.error("Failed to parse resume settings", error);
    return DEFAULT_RESUME_SETTINGS;
  }
};

export const fetchResumeSettingsFromApi = async () => {
  const payload = await apiGet('/app/preferences/resume');
  return { ...DEFAULT_RESUME_SETTINGS, ...(payload?.data || {}) };
};

export const saveResumeSettingsToApi = async (settings) => {
  const payload = await apiPut('/app/preferences/resume', settings);
  return { ...DEFAULT_RESUME_SETTINGS, ...(payload?.data || {}) };
};

export const saveResumeSettings = (settings) => {
  const next = { ...DEFAULT_RESUME_SETTINGS, ...settings };
  localStorage.setItem(RESUME_SETTINGS_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent("resume-settings-updated", { detail: next }));
  return next;
};
