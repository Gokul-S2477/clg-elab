import { apiGet, apiPut } from "./api";

const THEME_SETTINGS_KEY = "app-theme-settings";

export const THEMES = [
  { id: "default", name: "Classic Blue", class: "" },
  { id: "purple", name: "Royal Purple", class: "theme-purple" },
  { id: "green", name: "Emerald Green", class: "theme-green" },
  { id: "rose", name: "Midnight Rose", class: "theme-rose" },
  { id: "amber", name: "Golden Amber", class: "theme-amber" },
];

export const DEFAULT_THEME_SETTINGS = {
  themeId: "default",
  themeFreeze: false, // Super Admin only
};

export const getThemeSettings = () => {
  if (typeof window === "undefined") return DEFAULT_THEME_SETTINGS;
  try {
    const stored = JSON.parse(localStorage.getItem(THEME_SETTINGS_KEY) || "{}");
    return { ...DEFAULT_THEME_SETTINGS, ...stored };
  } catch {
    return DEFAULT_THEME_SETTINGS;
  }
};

export const applyTheme = (themeId) => {
  if (typeof document === "undefined") return;
  const theme = THEMES.find(t => t.id === themeId) || THEMES[0];
  const root = document.documentElement;
  
  // Remove all theme classes
  THEMES.forEach(t => {
    if (t.class) root.classList.remove(t.class);
  });
  
  // Add new theme class
  if (theme.class) root.classList.add(theme.class);
};

export const fetchThemeSettingsFromApi = async () => {
  const payload = await apiGet('/app/preferences/global_theme_settings');
  const settings = { ...DEFAULT_THEME_SETTINGS, ...(payload?.data || {}) };
  return settings;
};

export const saveThemeSettingsToApi = async (nextSettings) => {
  const payload = await apiPut('/app/preferences/global_theme_settings', nextSettings);
  return { ...DEFAULT_THEME_SETTINGS, ...(payload?.data || {}) };
};

export const saveThemeSettings = (nextSettings) => {
  if (typeof window === "undefined") return DEFAULT_THEME_SETTINGS;
  localStorage.setItem(THEME_SETTINGS_KEY, JSON.stringify(nextSettings));
  applyTheme(nextSettings.themeId);
  window.dispatchEvent(new CustomEvent("app-theme-settings-updated", { detail: nextSettings }));
  return nextSettings;
};
