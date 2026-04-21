import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import SaveStatusBadge from "../components/SaveStatusBadge";
import { pushAppNotification } from "../utils/appNotifications";
import { fetchAppShellSettingsFromApi, getAppShellSettings, saveAppShellSettings, saveAppShellSettingsToApi } from "../utils/appShellSettings";
import { fetchPlaygroundSettingsFromApi, getPlaygroundSettings, savePlaygroundSettings, savePlaygroundSettingsToApi } from "../utils/playgroundSettings";
import { fetchProctorSettingsFromApi, getProctorSettings, saveProctorSettings, saveProctorSettingsToApi } from "../utils/proctorSettings";
import { fetchResumeSettingsFromApi, getResumeSettings, saveResumeSettings, saveResumeSettingsToApi } from "../utils/resumeSettings";
import { fetchThemeSettingsFromApi, getThemeSettings, saveThemeSettings, saveThemeSettingsToApi, THEMES, applyTheme } from "../utils/themeSettings";
import { getStoredUser, isPrivilegedRole } from "../utils/roleHelper";
import { Palette, Shield, Terminal, Layout, Book, User, Lock, Check } from "lucide-react";

const SystemSettings = () => {
  const [user] = useState(getStoredUser());
  const [proctorSettings, setProctorSettings] = useState(() => getProctorSettings());
  const [playgroundSettings, setPlaygroundSettings] = useState(() => getPlaygroundSettings());
  const [resumeSettings, setResumeSettings] = useState(() => getResumeSettings());
  const [appShellSettings, setAppShellSettings] = useState(() => getAppShellSettings());
  const [themeSettings, setThemeSettings] = useState(() => getThemeSettings());
  const [saveMessage, setSaveMessage] = useState("");
  const [lastSavedAt, setLastSavedAt] = useState(null);

  const isAdmin = user?.role === "admin";
  const isSuperAdmin = user?.role === "super_admin";
  const isFaculty = user?.role === "faculty";

  useEffect(() => {
    if (!saveMessage) return undefined;
    const timeout = window.setTimeout(() => setSaveMessage(""), 2200);
    return () => window.clearTimeout(timeout);
  }, [saveMessage]);

  useEffect(() => {
    let mounted = true;
    Promise.allSettled([
      fetchProctorSettingsFromApi(),
      fetchPlaygroundSettingsFromApi(),
      fetchResumeSettingsFromApi(),
      fetchAppShellSettingsFromApi(),
      fetchThemeSettingsFromApi(),
    ]).then(([proctorRes, playgroundRes, resumeRes, shellRes, themeRes]) => {
      if (!mounted) return;
      if (proctorRes.status === "fulfilled") setProctorSettings(saveProctorSettings(proctorRes.value));
      if (playgroundRes.status === "fulfilled") setPlaygroundSettings(savePlaygroundSettings(playgroundRes.value));
      if (resumeRes.status === "fulfilled") setResumeSettings(saveResumeSettings(resumeRes.value));
      if (shellRes.status === "fulfilled") setAppShellSettings(saveAppShellSettings(shellRes.value));
      if (themeRes.status === "fulfilled") {
        const remoteTheme = themeRes.value;
        setThemeSettings(remoteTheme);
        if (remoteTheme.themeFreeze) {
          applyTheme(remoteTheme.themeId);
          saveThemeSettings(remoteTheme);
        }
      }
    });
    return () => { mounted = false; };
  }, []);

  const announceSave = (title, message) => {
    setSaveMessage(title);
    setLastSavedAt(new Date().toISOString());
    pushAppNotification({ title, message, tone: "success", href: "/settings" });
  };

  const handleToggle = (setter, getter, saver, key, title, msg) => {
    const next = saver({ ...getter, [key]: !getter[key] });
    setter(next);
    if (saver === saveProctorSettings) saveProctorSettingsToApi(next);
    if (saver === savePlaygroundSettings) savePlaygroundSettingsToApi(next);
    if (saver === saveResumeSettings) saveResumeSettingsToApi(next);
    if (saver === saveAppShellSettings) saveAppShellSettingsToApi(next);
    if (saver === saveThemeSettings) saveThemeSettingsToApi(next);
    announceSave(title, msg);
  };

  const handleThemeSelect = (themeId) => {
    if (themeSettings.themeFreeze && !isSuperAdmin) {
      announceSave("Theme Frozen", "System theme is currently locked by administrator.");
      return;
    }
    const next = saveThemeSettings({ ...themeSettings, themeId });
    setThemeSettings(next);
    saveThemeSettingsToApi(next);
    announceSave("Theme updated", `Applied ${THEMES.find(t => t.id === themeId)?.name} theme.`);
  };

  return (
    <div className="space-y-8 pb-20">
      <section className="erp-card rounded-[32px] p-8 erp-grid-bg border-none shadow-xl">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-600">Preferences</p>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">Personal & System Settings</h1>
            <p className="text-slate-600 font-medium">Manage your workspace experience and system-wide controls.</p>
          </div>
          <div className="flex items-center gap-4">
            {saveMessage && <span className="text-sm font-bold text-blue-600 animate-pulse">{saveMessage}</span>}
            <SaveStatusBadge value={lastSavedAt} />
          </div>
        </div>
      </section>

      <section className="erp-card rounded-[32px] p-8 border-none shadow-xl">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600">
            <Palette size={20} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Visual Identity</h2>
            <p className="text-sm text-slate-500 font-medium">Choose a color palette that suits your workflow.</p>
          </div>
        </div>

        {themeSettings.themeFreeze && !isSuperAdmin && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-100 rounded-2xl flex items-center gap-3 text-amber-700">
            <Lock size={18} />
            <span className="text-sm font-bold">Theme changes are currently restricted by Super Admin.</span>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {THEMES.map((theme) => (
            <button
              key={theme.id}
              onClick={() => handleThemeSelect(theme.id)}
              disabled={themeSettings.themeFreeze && !isSuperAdmin}
              className={`relative p-6 rounded-[24px] border-2 transition-all flex flex-col items-center gap-4 group ${
                themeSettings.themeId === theme.id 
                  ? "border-blue-600 bg-blue-50/30" 
                  : "border-slate-100 bg-slate-50/50 hover:border-blue-200"
              } ${(themeSettings.themeFreeze && !isSuperAdmin) ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <div className={`w-12 h-12 rounded-full shadow-lg transition-transform group-hover:scale-110 ${theme.id === 'default' ? 'bg-blue-600' : 
                theme.id === 'purple' ? 'bg-purple-600' :
                theme.id === 'green' ? 'bg-emerald-600' :
                theme.id === 'rose' ? 'bg-rose-600' : 'bg-amber-600'}`} />
              <span className="text-sm font-bold text-slate-900">{theme.name}</span>
              {themeSettings.themeId === theme.id && (
                <div className="absolute top-3 right-3 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white">
                  <Check size={14} />
                </div>
              )}
            </button>
          ))}
        </div>

        {isSuperAdmin && (
          <div className="mt-8 pt-8 border-t border-slate-100">
            <div className="flex items-center justify-between p-6 bg-slate-900 rounded-[24px] text-white">
              <div>
                <h3 className="font-bold text-lg">Global Theme Lock</h3>
                <p className="text-slate-400 text-sm">Force the selected theme for all users and disable personal changes.</p>
              </div>
              <button 
                onClick={() => handleToggle(setThemeSettings, themeSettings, saveThemeSettings, "themeFreeze", "Global Lock Updated", "Theme restriction has been applied system-wide.")}
                className={`px-6 py-3 rounded-xl font-bold transition-all ${themeSettings.themeFreeze ? "bg-red-500 hover:bg-red-600" : "bg-blue-600 hover:bg-blue-700"}`}
              >
                {themeSettings.themeFreeze ? "Unlock Themes" : "Freeze System Theme"}
              </button>
            </div>
          </div>
        )}
      </section>

      {(isAdmin || isSuperAdmin) && (
        <section className="erp-card rounded-[32px] p-8 border-none shadow-xl">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center text-red-600">
              <Shield size={20} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">System Integrity</h2>
              <p className="text-sm text-slate-500 font-medium">Configure security and proctoring rules.</p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {[
              { key: "copyPasteLocked", title: "Block Clipboard Access", desc: "Disable copy/paste in practice areas." },
              { key: "extensionGuardEnabled", title: "Browser Guard", desc: "Monitor tab switching and focus loss." },
              { key: "requireFullscreen", title: "Enforce Fullscreen", desc: "Require fullscreen for active sessions." },
              { key: "watermarkEnabled", title: "Learner Watermark", desc: "Display traceability overlay." },
            ].map(item => (
              <div key={item.key} className="p-6 rounded-[24px] bg-slate-50/50 border border-slate-100 flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-900">{item.title}</p>
                  <p className="text-xs text-slate-500 mt-1">{item.desc}</p>
                </div>
                <button 
                  onClick={() => handleToggle(setProctorSettings, proctorSettings, saveProctorSettings, item.key, "Security Updated", "Integrity rules have been synchronized.")}
                  className={`w-12 h-6 rounded-full transition-all relative ${proctorSettings[item.key] ? "bg-blue-600" : "bg-slate-300"}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${proctorSettings[item.key] ? "left-7" : "left-1"}`} />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {(isFaculty || isSuperAdmin || isAdmin) && (
        <section className="erp-card rounded-[32px] p-8 border-none shadow-xl">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600">
              <Book size={20} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">Curriculum Controls</h2>
              <p className="text-sm text-slate-500 font-medium">Manage how students interact with learning modules.</p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="p-6 rounded-[24px] bg-slate-50/50 border border-slate-100 flex items-center justify-between">
              <div>
                <p className="font-bold text-slate-900">Study Lock Mode</p>
                <p className="text-xs text-slate-500 mt-1">Force sequential lesson completion.</p>
              </div>
              <button 
                onClick={() => handleToggle(setPlaygroundSettings, playgroundSettings, savePlaygroundSettings, "studyLockMode", "Study Mode Updated", "Curriculum flow has been updated.")}
                className={`w-12 h-6 rounded-full transition-all relative ${playgroundSettings.studyLockMode ? "bg-emerald-600" : "bg-slate-300"}`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${playgroundSettings.studyLockMode ? "left-7" : "left-1"}`} />
              </button>
            </div>
            <div className="p-6 rounded-[24px] bg-slate-50/50 border border-slate-100 flex items-center justify-between">
              <div>
                <p className="font-bold text-slate-900">AI Compiler Access</p>
                <p className="text-xs text-slate-500 mt-1">Enable AI-assisted coding playground.</p>
              </div>
              <button 
                onClick={() => handleToggle(setPlaygroundSettings, playgroundSettings, savePlaygroundSettings, "compilerEnabled", "Tooling Updated", "Lab environment settings saved.")}
                className={`w-12 h-6 rounded-full transition-all relative ${playgroundSettings.compilerEnabled ? "bg-emerald-600" : "bg-slate-300"}`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${playgroundSettings.compilerEnabled ? "left-7" : "left-1"}`} />
              </button>
            </div>
          </div>
        </section>
      )}

      {(isAdmin || isSuperAdmin) && (
        <section className="erp-card rounded-[32px] p-8 border-none shadow-xl">
           <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600">
              <Layout size={20} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">Interface Controls</h2>
              <p className="text-sm text-slate-500 font-medium">Enable or disable core shell features.</p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {[
              { key: "commandPaletteEnabled", title: "Universal Search", desc: "Quick-jump command palette access." },
              { key: "activityFeedEnabled", title: "Live Activity Feed", desc: "Real-time updates in top navigation." },
              { key: "dashboardInsightsEnabled", title: "Dashboard Analytics", desc: "Show performance charts on home." },
            ].map(item => (
              <div key={item.key} className="p-6 rounded-[24px] bg-slate-50/50 border border-slate-100 flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-900">{item.title}</p>
                  <p className="text-xs text-slate-500 mt-1">{item.desc}</p>
                </div>
                <button 
                  onClick={() => handleToggle(setAppShellSettings, appShellSettings, saveAppShellSettings, item.key, "UI Updated", "Interface settings synchronized.")}
                  className={`w-12 h-6 rounded-full transition-all relative ${appShellSettings[item.key] ? "bg-indigo-600" : "bg-slate-300"}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${appShellSettings[item.key] ? "left-7" : "left-1"}`} />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default SystemSettings;
