import { apiGet, apiPut } from "./api";

const APP_SHELL_SETTINGS_KEY = "app-shell-settings";

export const DEFAULT_APP_SHELL_SETTINGS = {
  commandPaletteEnabled: true,
  activityFeedEnabled: true,
  announcementBannerEnabled: true,
  dashboardInsightsEnabled: true,
};

export const getAppShellSettings = () => {
  if (typeof window === "undefined") return DEFAULT_APP_SHELL_SETTINGS;
  try {
    const stored = JSON.parse(localStorage.getItem(APP_SHELL_SETTINGS_KEY) || "{}");
    return { ...DEFAULT_APP_SHELL_SETTINGS, ...stored };
  } catch {
    return DEFAULT_APP_SHELL_SETTINGS;
  }
};

export const fetchAppShellSettingsFromApi = async () => {
  const payload = await apiGet('/app/preferences/app-shell');
  return { ...DEFAULT_APP_SHELL_SETTINGS, ...(payload?.data || {}) };
};

export const saveAppShellSettingsToApi = async (settings) => {
  const payload = await apiPut('/app/preferences/app-shell', settings);
  return { ...DEFAULT_APP_SHELL_SETTINGS, ...(payload?.data || {}) };
};

export const saveAppShellSettings = (settings) => {
  if (typeof window === "undefined") return DEFAULT_APP_SHELL_SETTINGS;
  const next = { ...DEFAULT_APP_SHELL_SETTINGS, ...settings };
  localStorage.setItem(APP_SHELL_SETTINGS_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent("app-shell-settings-updated", { detail: next }));
  return next;
};
