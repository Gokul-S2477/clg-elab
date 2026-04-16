import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import SaveStatusBadge from "../components/SaveStatusBadge";
import { pushAppNotification } from "../utils/appNotifications";
import { fetchAppShellSettingsFromApi, getAppShellSettings, saveAppShellSettings, saveAppShellSettingsToApi } from "../utils/appShellSettings";
import { fetchPlaygroundSettingsFromApi, getPlaygroundSettings, savePlaygroundSettings, savePlaygroundSettingsToApi } from "../utils/playgroundSettings";
import { fetchProctorSettingsFromApi, getProctorSettings, saveProctorSettings, saveProctorSettingsToApi } from "../utils/proctorSettings";
import { fetchResumeSettingsFromApi, getResumeSettings, saveResumeSettings, saveResumeSettingsToApi } from "../utils/resumeSettings";
import { getStoredUser, isPrivilegedRole } from "../utils/roleHelper";

const settingCards = [
  { key: "copyPasteLocked", title: "Disable student copy / paste", description: "Blocks copy, cut, paste, paste special, context menu, and common clipboard shortcuts inside Practice Arena for students." },
  { key: "extensionGuardEnabled", title: "Enable browser guard", description: "Shows a guarded overlay when students switch tabs or lose focus." },
  { key: "blurOnFocusLoss", title: "Blur on tab switch", description: "Locks the workspace when the tab loses focus or becomes hidden." },
  { key: "requireFullscreen", title: "Require fullscreen mode", description: "Prompts students to stay in fullscreen before continuing the workspace." },
  { key: "examCameraRequired", title: "Require camera permission", description: "Students must grant webcam access before they can start a proctored exam attempt." },
  { key: "examMicrophoneRequired", title: "Require microphone permission", description: "Students must grant microphone access before they can start a proctored exam attempt." },
  { key: "blockQuestionSelection", title: "Block student text selection", description: "Prevents question text selection for students while the proctor lock is active." },
  { key: "disableStudentNotes", title: "Disable notes for students", description: "Hides the private notes panel from students while still allowing admins to use it." },
  { key: "watermarkEnabled", title: "Show learner watermark", description: "Displays a soft identity watermark over the workspace so screenshots are traceable." },
];

const appShellCards = [
  { key: "commandPaletteEnabled", title: "Enable command search", description: "Keeps the top app search and quick-jump palette available across the shell." },
  { key: "activityFeedEnabled", title: "Enable activity feed", description: "Shows recent app notifications and save activity in the top navigation and dashboard." },
  { key: "announcementBannerEnabled", title: "Enable announcement banner", description: "Displays the top announcement strip from Content Studio across the app shell." },
  { key: "dashboardInsightsEnabled", title: "Enable dashboard insights", description: "Shows analytics and progress summaries on the main dashboard." },
];

const SystemSettings = () => {
  const [user] = useState(getStoredUser());
  const [settings, setSettings] = useState(() => getProctorSettings());
  const [playgroundSettings, setPlaygroundSettings] = useState(() => getPlaygroundSettings());
  const [resumeSettings, setResumeSettings] = useState(() => getResumeSettings());
  const [appShellSettings, setAppShellSettings] = useState(() => getAppShellSettings());
  const [saveMessage, setSaveMessage] = useState("");
  const [lastSavedAt, setLastSavedAt] = useState(null);

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
    ]).then(([proctorResult, playgroundResult, resumeResult, shellResult]) => {
      if (!mounted) return;
      if (proctorResult.status === "fulfilled") setSettings(saveProctorSettings(proctorResult.value));
      if (playgroundResult.status === "fulfilled") setPlaygroundSettings(savePlaygroundSettings(playgroundResult.value));
      if (resumeResult.status === "fulfilled") setResumeSettings(saveResumeSettings(resumeResult.value));
      if (shellResult.status === "fulfilled") setAppShellSettings(saveAppShellSettings(shellResult.value));
    });
    return () => { mounted = false; };
  }, []);

  if (!isPrivilegedRole(user?.role)) {
    return <Navigate to="/practice" replace />;
  }

  const announceSave = (title, message) => {
    setSaveMessage(title);
    setLastSavedAt(new Date().toISOString());
    pushAppNotification({ title, message, tone: "success", href: "/settings" });
  };

  const handleToggle = (key) => {
    const next = saveProctorSettings({ ...settings, [key]: !settings[key] });
    setSettings(next);
    saveProctorSettingsToApi(next).catch(() => {});
    announceSave("Proctor settings updated", "Student protection rules were updated across the workspace.");
  };

  const handlePlaygroundToggle = (key) => {
    const next = savePlaygroundSettings({ ...playgroundSettings, [key]: !playgroundSettings[key] });
    setPlaygroundSettings(next);
    savePlaygroundSettingsToApi(next).catch(() => {});
    announceSave("Playground settings updated", "Playground visibility or behavior changed successfully.");
  };

  const handlePlaygroundNumber = (key, value, min, max) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return;
    const nextValue = Math.min(max, Math.max(min, parsed));
    const next = savePlaygroundSettings({ ...playgroundSettings, [key]: nextValue });
    setPlaygroundSettings(next);
    savePlaygroundSettingsToApi(next).catch(() => {});
    announceSave("Playground settings updated", "Numeric playground limits were saved.");
  };

  const handleResumeToggle = (key) => {
    const next = saveResumeSettings({ ...resumeSettings, [key]: !resumeSettings[key] });
    setResumeSettings(next);
    saveResumeSettingsToApi(next).catch(() => {});
    announceSave("Resume settings updated", "Resume and profile permissions were updated.");
  };

  const handleAppShellToggle = (key) => {
    const next = saveAppShellSettings({ ...appShellSettings, [key]: !appShellSettings[key] });
    setAppShellSettings(next);
    saveAppShellSettingsToApi(next).catch(() => {});
    announceSave("App shell settings updated", "Whole-app shell behavior was updated.");
  };

  return (
    <div className="space-y-6">
      <section className="erp-card rounded-[30px] p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.4em] text-blue-600">Main Settings</p>
            <h1 className="mt-3 text-3xl font-extrabold text-slate-900">System Controls</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">Manage protection rules, shell behavior, study access, playground defaults, and resume/profile permissions from one privileged panel.</p>
            {saveMessage && <p className="mt-4 text-sm font-semibold text-blue-600">{saveMessage}</p>}
          </div>
          <SaveStatusBadge value={lastSavedAt} tone="success" />
        </div>
      </section>

      <section className="erp-card rounded-[30px] p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.4em] text-blue-600">App Experience</p>
        <h2 className="mt-3 text-2xl font-extrabold text-slate-900">Whole-app shell controls</h2>
        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {appShellCards.map((item) => (
            <div key={item.key} className="rounded-[28px] border border-blue-100 bg-blue-50/50 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-lg font-bold text-slate-900">{item.title}</p>
                  <p className="mt-2 text-sm leading-7 text-slate-600">{item.description}</p>
                </div>
                <button type="button" onClick={() => handleAppShellToggle(item.key)} className={`rounded-full px-4 py-2 text-sm font-bold ${appShellSettings[item.key] ? "border border-blue-200 bg-white text-blue-700" : "border border-slate-200 bg-white text-slate-600"}`}>
                  {appShellSettings[item.key] ? "Enabled" : "Disabled"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        {settingCards.map((item) => (
          <div key={item.key} className="erp-card rounded-[28px] p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-lg font-bold text-slate-900">{item.title}</p>
                <p className="mt-2 text-sm leading-7 text-slate-600">{item.description}</p>
              </div>
              <button type="button" onClick={() => handleToggle(item.key)} className={`rounded-full px-4 py-2 text-sm font-bold ${settings[item.key] ? "border border-blue-200 bg-blue-50 text-blue-700" : "border border-slate-200 bg-white text-slate-600"}`}>
                {settings[item.key] ? "Enabled" : "Disabled"}
              </button>
            </div>
          </div>
        ))}
      </section>

      <section className="erp-card rounded-[28px] border border-amber-100 bg-amber-50/70 p-5">
        <p className="text-sm font-bold text-amber-800">Important note</p>
        <p className="mt-2 text-sm leading-7 text-amber-700">A normal web app cannot truly disable installed browser extensions at the browser level. What we can do reliably is harden the page with copy/paste blocking, focus-loss guards, fullscreen checks, and protected overlays so the student workflow is much more controlled.</p>
      </section>

      <section className="erp-card rounded-[30px] p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.4em] text-blue-600">Study Settings</p>
        <h2 className="mt-3 text-2xl font-extrabold text-slate-900">Study Module Controls</h2>
        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          <div className="erp-soft-card rounded-[28px] p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-lg font-bold text-slate-900">Enable Study lock mode</p>
                <p className="mt-2 text-sm leading-7 text-slate-600">When enabled, students unlock SQL study topics sequentially. Turn it off if you want learners to jump freely between lessons from the sidebar.</p>
              </div>
              <button type="button" onClick={() => handlePlaygroundToggle("studyLockMode")} className={`rounded-full px-4 py-2 text-sm font-bold ${playgroundSettings.studyLockMode ? "border border-blue-200 bg-blue-50 text-blue-700" : "border border-slate-200 bg-white text-slate-600"}`}>{playgroundSettings.studyLockMode ? "Enabled" : "Disabled"}</button>
            </div>
          </div>
          <div className="erp-card rounded-[28px] border border-blue-100 bg-blue-50/70 p-5">
            <p className="text-sm font-bold text-blue-900">Current behavior</p>
            <p className="mt-2 text-sm leading-7 text-blue-800">{playgroundSettings.studyLockMode ? "Students can only open the next unlocked topic after completing the current one." : "All study topics are open, so students can enter any topic directly."}</p>
          </div>
        </div>
      </section>

      <section className="erp-card rounded-[30px] p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.4em] text-blue-600">Playground Settings</p>
        <h2 className="mt-3 text-2xl font-extrabold text-slate-900">Playground Controls</h2>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        {[
          { key: "compilerEnabled", title: "Enable Compiler Lab", description: "Show or hide Compiler Lab for users." },
          { key: "appEnabled", title: "Enable App Playground", description: "Show or hide Streamlit app playground." },
          { key: "sqlEnabled", title: "Enable SQL Playground", description: "Show or hide SQL dataset playground." },
          { key: "notebookEnabled", title: "Enable Notebook Lab", description: "Show or hide notebook-style coding lab." },
          { key: "showSchemaDiagrams", title: "Show schema diagrams", description: "Display ER-like schema diagrams for supported SQL datasets." },
          { key: "enableSqlHistory", title: "Enable SQL query history", description: "Keep local per-user SQL query history in browser storage." },
          { key: "compactSqlSidebar", title: "Compact SQL sidebar", description: "Use tighter spacing in SQL schema panel." },
          { key: "sqlTableDenseMode", title: "Dense SQL result table", description: "Use tighter row density for SQL result grids." },
          { key: "autoRunLastSqlOnDatasetChange", title: "Auto-run on dataset change", description: "Run latest SQL query automatically after changing dataset." },
          { key: "keepNotebookOutputsOnLanguageSwitch", title: "Keep notebook outputs on language switch", description: "Retain notebook outputs instead of clearing when language changes." },
        ].map((item) => (
          <div key={item.key} className="erp-card rounded-[28px] p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-lg font-bold text-slate-900">{item.title}</p>
                <p className="mt-2 text-sm leading-7 text-slate-600">{item.description}</p>
              </div>
              <button type="button" onClick={() => handlePlaygroundToggle(item.key)} className={`rounded-full px-4 py-2 text-sm font-bold ${playgroundSettings[item.key] ? "border border-blue-200 bg-blue-50 text-blue-700" : "border border-slate-200 bg-white text-slate-600"}`}>{playgroundSettings[item.key] ? "Enabled" : "Disabled"}</button>
            </div>
          </div>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <div className="erp-card rounded-[24px] p-5"><p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">SQL Page Size</p><input type="number" min={50} max={500} value={playgroundSettings.sqlPageSize} onChange={(e) => handlePlaygroundNumber("sqlPageSize", e.target.value, 50, 500)} className="mt-3 w-full rounded-2xl border border-blue-100 bg-[#f8fbff] px-4 py-3 text-sm font-semibold text-slate-700 outline-none" /></div>
        <div className="erp-card rounded-[24px] p-5"><p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Max Notebook Cells</p><input type="number" min={5} max={100} value={playgroundSettings.maxNotebookCells} onChange={(e) => handlePlaygroundNumber("maxNotebookCells", e.target.value, 5, 100)} className="mt-3 w-full rounded-2xl border border-blue-100 bg-[#f8fbff] px-4 py-3 text-sm font-semibold text-slate-700 outline-none" /></div>
        <div className="erp-card rounded-[24px] border border-blue-100 bg-blue-50/70 p-5"><p className="text-sm font-bold text-blue-900">Advanced Note</p><p className="mt-2 text-sm leading-7 text-blue-800">These settings are applied immediately in Playground via browser storage and can be tuned without code changes.</p></div>
      </section>

      <section className="erp-card rounded-[30px] p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.4em] text-blue-600">Resume Settings</p>
        <h2 className="mt-3 text-2xl font-extrabold text-slate-900">Resume Builder Controls</h2>
        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          <div className="erp-card rounded-[28px] p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-lg font-bold text-slate-900">Allow students to edit profile basics</p>
                <p className="mt-2 text-sm leading-7 text-slate-600">When disabled, students can still use their stored profile data in Resume Builder, but only privileged roles can change it.</p>
              </div>
              <button type="button" onClick={() => handleResumeToggle("studentProfileEditEnabled")} className={`rounded-full px-4 py-2 text-sm font-bold ${resumeSettings.studentProfileEditEnabled ? "border border-blue-200 bg-blue-50 text-blue-700" : "border border-slate-200 bg-white text-slate-600"}`}>{resumeSettings.studentProfileEditEnabled ? "Enabled" : "Disabled"}</button>
            </div>
          </div>
          <div className="erp-card rounded-[28px] border border-blue-100 bg-blue-50/70 p-5"><p className="text-sm font-bold text-blue-900">Current behavior</p><p className="mt-2 text-sm leading-7 text-blue-800">{resumeSettings.studentProfileEditEnabled ? "Students can update their reusable profile from the Profile Center and Resume Builder." : "Students see profile basics in read-only mode. Faculty and admins still keep edit access."}</p></div>
        </div>
      </section>
    </div>
  );
};

export default SystemSettings;
