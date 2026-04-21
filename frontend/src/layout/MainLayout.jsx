import React, { useEffect } from "react";
import { Outlet } from "react-router-dom";
import Navbar from "../components/Navbar";
import { applyTheme, getThemeSettings, fetchThemeSettingsFromApi, saveThemeSettings } from "../utils/themeSettings";

const MainLayout = () => {
  useEffect(() => {
    // 1. Apply local theme immediately for speed
    const local = getThemeSettings();
    applyTheme(local.themeId);

    // 2. Fetch remote theme to check for freeze
    fetchThemeSettingsFromApi().then(remote => {
      if (remote.themeFreeze) {
        // If frozen, force remote theme
        applyTheme(remote.themeId);
        saveThemeSettings(remote);
      }
    });

    const handleThemeUpdate = (e) => {
      applyTheme(e.detail.themeId);
    };

    window.addEventListener("app-theme-settings-updated", handleThemeUpdate);
    return () => window.removeEventListener("app-theme-settings-updated", handleThemeUpdate);
  }, []);

  return (
    <div className="min-h-screen bg-transparent text-slate-900">
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <main className="flex-1 px-4 pb-6 pt-[110px] md:px-6 md:pt-[112px] lg:px-8">
          <div className="erp-fade-in mx-auto w-full max-w-[1500px]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
