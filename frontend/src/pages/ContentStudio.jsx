import React, { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import SaveStatusBadge from "../components/SaveStatusBadge";
import { getStoredUser, isPrivilegedRole } from "../utils/roleHelper";
import {
  addContentStudioVersion,
  exportContentStudioWorkspace,
  fetchContentStudioWorkspaceFromApi,
  importContentStudioWorkspace,
  readContentStudioWorkspace,
  saveContentStudioWorkspace,
  saveContentStudioWorkspaceToApi,
} from "../utils/contentStudioStorage";
import { pushAppNotification } from "../utils/appNotifications";

const ContentStudio = () => {
  const user = getStoredUser();
  const [workspace, setWorkspace] = useState(() => readContentStudioWorkspace());
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [importValue, setImportValue] = useState("");

  useEffect(() => {
    let mounted = true;
    const localWorkspace = readContentStudioWorkspace();
    setWorkspace(localWorkspace);
    fetchContentStudioWorkspaceFromApi()
      .then((remoteWorkspace) => {
        if (!mounted) return;
        saveContentStudioWorkspace(remoteWorkspace);
        setWorkspace(remoteWorkspace);
      })
      .catch(() => {});
    return () => { mounted = false; };
  }, []);

  if (!isPrivilegedRole(user?.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  const moduleHealth = useMemo(() => {
    const published = workspace.modules.filter((module) => module.status === "published").length;
    const drafts = workspace.modules.filter((module) => module.status !== "published").length;
    return { published, drafts, total: workspace.modules.length };
  }, [workspace]);

  const persist = (nextWorkspace) => {
    saveContentStudioWorkspace(nextWorkspace);
    setWorkspace(nextWorkspace);
    setLastSavedAt(new Date().toISOString());
    saveContentStudioWorkspaceToApi(nextWorkspace).catch(() => {});
  };

  const updateModule = (moduleId, key, value) => {
    const nextWorkspace = {
      ...workspace,
      modules: workspace.modules.map((module) =>
        module.id === moduleId ? { ...module, [key]: value, updatedAt: new Date().toISOString() } : module,
      ),
    };
    persist(nextWorkspace);
  };

  const updateAnnouncement = (announcementId, key, value) => {
    const nextWorkspace = {
      ...workspace,
      announcements: workspace.announcements.map((announcement) =>
        announcement.id === announcementId ? { ...announcement, [key]: value, updatedAt: new Date().toISOString() } : announcement,
      ),
    };
    persist(nextWorkspace);
  };

  const addVersionNote = () => {
    const nextWorkspace = addContentStudioVersion(workspace, "Manual content studio update");
    persist(nextWorkspace);
    pushAppNotification({ title: "Version note added", message: "A new content release note was added to Content Studio.", tone: "success", href: "/content-studio" });
  };

  const handleExport = () => {
    const blob = new Blob([exportContentStudioWorkspace()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "content-studio-workspace.json";
    link.click();
    URL.revokeObjectURL(url);
    pushAppNotification({ title: "Content exported", message: "A JSON backup of the content studio was downloaded.", tone: "info", href: "/content-studio" });
  };

  const handleImport = () => {
    if (!importValue.trim()) return;
    try {
      const nextWorkspace = importContentStudioWorkspace(importValue);
      saveContentStudioWorkspaceToApi(nextWorkspace).catch(() => {});
      setImportValue("");
      setWorkspace(nextWorkspace);
      setLastSavedAt(new Date().toISOString());
      pushAppNotification({ title: "Content imported", message: "The content studio workspace was restored from JSON.", tone: "success", href: "/content-studio" });
    } catch {
      pushAppNotification({ title: "Import failed", message: "The provided JSON could not be imported. Please check the format.", tone: "danger", href: "/content-studio" });
    }
  };

  return (
    <div className="space-y-6">
      <section className="erp-card rounded-[32px] px-6 py-8 md:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.45em] text-blue-600">Content Studio</p>
            <h1 className="mt-3 text-4xl font-extrabold text-slate-900">Manage modules, releases, and learner-facing content from one place.</h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">
              This is the reusable content layer for the app. Use it to keep study modules, practice inventory, resume resources, announcements, and release notes organized instead of scattering them across isolated screens.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <SaveStatusBadge value={lastSavedAt} tone="success" />
            <button type="button" onClick={addVersionNote} className="rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700">Add Version</button>
            <button type="button" onClick={handleExport} className="rounded-full bg-[#0F5BD8] px-4 py-2 text-sm font-bold text-white">Export JSON</button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {[
          { label: "Published modules", value: moduleHealth.published, hint: `${moduleHealth.total} tracked content spaces` },
          { label: "Draft modules", value: moduleHealth.drafts, hint: "Spaces still under review" },
          { label: "Version notes", value: workspace.versions.length, hint: "Recent content revisions" },
        ].map((card) => (
          <article key={card.label} className="erp-card rounded-[28px] p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-600">{card.label}</p>
            <p className="mt-4 text-3xl font-extrabold text-slate-900">{card.value}</p>
            <p className="mt-2 text-sm text-slate-600">{card.hint}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="erp-card rounded-[28px] p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-600">Module Registry</p>
              <h2 className="mt-2 text-2xl font-extrabold text-slate-900">Reusable content structure</h2>
            </div>
            <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">Versioned</span>
          </div>
          <div className="mt-5 space-y-4">
            {workspace.modules.map((module) => (
              <div key={module.id} className="rounded-[24px] border border-blue-100 bg-blue-50/40 p-4">
                <div className="grid gap-3 md:grid-cols-2">
                  {[
                    ["title", "Title"],
                    ["owner", "Owner"],
                    ["version", "Version"],
                    ["learnerCountHint", "Coverage Hint"],
                    ["status", "Status"],
                    ["topics", "Topics / Items"],
                  ].map(([key, label]) => (
                    <label key={`${module.id}-${key}`} className="text-sm font-semibold text-slate-700">
                      {label}
                      <input
                        value={module[key] ?? ""}
                        onChange={(event) => updateModule(module.id, key, key === "topics" ? Number(event.target.value || 0) : event.target.value)}
                        className="mt-2 w-full rounded-2xl border border-white bg-white px-4 py-3 text-sm font-medium text-slate-700 outline-none"
                      />
                    </label>
                  ))}
                </div>
                <label className="mt-3 block text-sm font-semibold text-slate-700">
                  Description
                  <textarea
                    value={module.description || ""}
                    onChange={(event) => updateModule(module.id, "description", event.target.value)}
                    rows={3}
                    className="mt-2 w-full rounded-2xl border border-white bg-white px-4 py-3 text-sm font-medium text-slate-700 outline-none"
                  />
                </label>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="erp-card rounded-[28px] p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-600">Announcements</p>
            <h2 className="mt-2 text-2xl font-extrabold text-slate-900">Learner communication</h2>
            <div className="mt-5 space-y-4">
              {workspace.announcements.map((announcement) => (
                <div key={announcement.id} className="rounded-[24px] border border-blue-100 bg-blue-50/40 p-4">
                  <input value={announcement.title || ""} onChange={(event) => updateAnnouncement(announcement.id, "title", event.target.value)} className="w-full rounded-2xl border border-white bg-white px-4 py-3 text-sm font-bold text-slate-800 outline-none" />
                  <textarea value={announcement.message || ""} onChange={(event) => updateAnnouncement(announcement.id, "message", event.target.value)} rows={4} className="mt-3 w-full rounded-2xl border border-white bg-white px-4 py-3 text-sm font-medium text-slate-700 outline-none" />
                </div>
              ))}
            </div>
          </div>

          <div className="erp-card rounded-[28px] p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-600">Release Notes</p>
                <h2 className="mt-2 text-2xl font-extrabold text-slate-900">Version history</h2>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {workspace.versions.map((version) => (
                <div key={version.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-bold text-slate-900">{version.label}</p>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">{new Date(version.createdAt).toLocaleString()}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{version.notes}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="erp-card rounded-[28px] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-600">Import / Restore</p>
            <h2 className="mt-2 text-2xl font-extrabold text-slate-900">Bring content workspace JSON back into the app</h2>
          </div>
          <button type="button" onClick={handleImport} className="rounded-full bg-[#0F5BD8] px-4 py-2 text-sm font-bold text-white">Import JSON</button>
        </div>
        <textarea
          value={importValue}
          onChange={(event) => setImportValue(event.target.value)}
          rows={8}
          placeholder="Paste content-studio-workspace.json here to restore module metadata, announcements, and versions."
          className="mt-4 w-full rounded-[24px] border border-blue-100 bg-[#f8fbff] px-4 py-4 text-sm font-medium text-slate-700 outline-none"
        />
      </section>
    </div>
  );
};

export default ContentStudio;
