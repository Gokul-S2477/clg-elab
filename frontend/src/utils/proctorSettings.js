import { apiGet, apiPut } from "./api";

const PROCTOR_SETTINGS_KEY = "practice-proctor-settings";

export const DEFAULT_PROCTOR_SETTINGS = {
  copyPasteLocked: true,
  extensionGuardEnabled: true,
  blurOnFocusLoss: true,
  requireFullscreen: true,
  disableStudentNotes: false,
  watermarkEnabled: true,
  blockQuestionSelection: true,
  examCameraRequired: true,
  examMicrophoneRequired: true,
  fullscreenRecoverySeconds: 10,
  maxFullscreenViolationsBeforeLogout: 1,
};

export const getProctorSettings = () => {
  if (typeof window === "undefined") return DEFAULT_PROCTOR_SETTINGS;
  try {
    const stored = JSON.parse(localStorage.getItem(PROCTOR_SETTINGS_KEY) || "{}");
    return {
      ...DEFAULT_PROCTOR_SETTINGS,
      ...stored,
    };
  } catch {
    return DEFAULT_PROCTOR_SETTINGS;
  }
};

export const fetchProctorSettingsFromApi = async () => {
  const payload = await apiGet('/app/preferences/proctor');
  return { ...DEFAULT_PROCTOR_SETTINGS, ...(payload?.data || {}) };
};

export const saveProctorSettingsToApi = async (nextSettings) => {
  const payload = await apiPut('/app/preferences/proctor', nextSettings);
  return { ...DEFAULT_PROCTOR_SETTINGS, ...(payload?.data || {}) };
};

export const saveProctorSettings = (nextSettings) => {
  if (typeof window === "undefined") return DEFAULT_PROCTOR_SETTINGS;
  const next = {
    ...DEFAULT_PROCTOR_SETTINGS,
    ...nextSettings,
  };
  localStorage.setItem(PROCTOR_SETTINGS_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent("practice-proctor-settings-updated", { detail: next }));
  return next;
};

export const isFullscreenActive = () => {
  if (typeof document === "undefined") return false;
  return Boolean(document.fullscreenElement);
};
