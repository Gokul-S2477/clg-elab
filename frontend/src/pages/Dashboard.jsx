import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import SaveStatusBadge from "../components/SaveStatusBadge";
import { getDashboardAnalytics } from "../utils/dashboardAnalytics";
import { getContentStudioEventName, readContentStudioWorkspace } from "../utils/contentStudioStorage";
import { getRoleLabel } from "../utils/roleHelper";
import { getAppShellSettings } from "../utils/appShellSettings";

const Dashboard = () => {
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState(() => getDashboardAnalytics());
  const [lastRefresh, setLastRefresh] = useState(() => new Date().toISOString());
  const [shellSettings, setShellSettings] = useState(() => getAppShellSettings());
  const [announcement, setAnnouncement] = useState(() => readContentStudioWorkspace().announcements?.[0] || null);

  useEffect(() => {
    const refresh = () => {
      setAnalytics(getDashboardAnalytics());
      setLastRefresh(new Date().toISOString());
    };
    const refreshContent = () => setAnnouncement(readContentStudioWorkspace().announcements?.[0] || null);
    window.addEventListener("resume-workspace-updated", refresh);
    window.addEventListener("profile-updated", refresh);
    window.addEventListener("app-notification-added", refresh);
    window.addEventListener(getContentStudioEventName(), refreshContent);
    const refreshShell = () => setShellSettings(getAppShellSettings());
    window.addEventListener("storage", refresh);
    window.addEventListener("app-shell-settings-updated", refreshShell);
    return () => {
      window.removeEventListener("resume-workspace-updated", refresh);
      window.removeEventListener("profile-updated", refresh);
      window.removeEventListener("app-notification-added", refresh);
      window.removeEventListener(getContentStudioEventName(), refreshContent);
      window.removeEventListener("storage", refresh);
      window.removeEventListener("app-shell-settings-updated", refreshShell);
    };
  }, []);

  const cards = useMemo(() => [
    { title: "Current Role", value: getRoleLabel(analytics.user?.role), accent: "from-blue-600 to-blue-500", hint: "Role-aware access across the workspace" },
    { title: "Practice Progress", value: `${analytics.practice.solved}/${analytics.practice.total}`, accent: "from-cyan-600 to-blue-500", hint: `${analytics.practice.attempted} attempted` },
    { title: "Study Completion", value: `${analytics.study.completion}%`, accent: "from-sky-500 to-cyan-400", hint: `${analytics.study.completedTopics} SQL topics completed` },
    { title: "Resume Space", value: `${analytics.resume.totalResumes}/3`, accent: "from-indigo-600 to-blue-500", hint: analytics.resume.activeResumeName },
  ], [analytics]);

  const adminCards = useMemo(() => analytics.isPrivileged ? [
    { label: "Content Studio", hint: "Manage modules, announcements, and versions", to: "/content-studio" },
    { label: "Main Settings", hint: "System controls and learner permissions", to: "/settings" },
    { label: "Question Builder", hint: "Review and publish practice questions", to: "/practice-arena-admin" },
  ] : [], [analytics.isPrivileged]);

  return (
    <div className="space-y-6">
      <section className="erp-card erp-grid-bg rounded-[32px] px-6 py-8 md:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.45em] text-blue-600">Dashboard</p>
            <h1 className="mt-3 text-4xl font-extrabold text-slate-900">Welcome back{analytics.user?.name ? `, ${analytics.user.name}` : ""}.</h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">
              This dashboard now acts as the command center for the whole app: profile, study, practice, resume, activity feed, and privileged content controls all connect here.
            </p>
          </div>
          <SaveStatusBadge value={lastRefresh} />
        </div>
        {shellSettings.announcementBannerEnabled && announcement && (
          <div className="mt-6 rounded-[24px] border border-blue-100 bg-blue-50/70 px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-blue-600">Latest Announcement</p>
            <p className="mt-2 text-lg font-bold text-slate-900">{announcement.title}</p>
            <p className="mt-2 text-sm leading-7 text-slate-600">{announcement.message}</p>
          </div>
        )}
      </section>

      {shellSettings.dashboardInsightsEnabled && <section className="grid gap-5 xl:grid-cols-4">
        {cards.map((card) => (
          <article key={card.title} className="erp-card rounded-[28px] p-5">
            <div className={`inline-flex rounded-full bg-gradient-to-r px-4 py-2 text-xs font-bold uppercase tracking-[0.3em] text-white ${card.accent}`}>{card.title}</div>
            <p className="mt-6 text-3xl font-extrabold text-slate-900">{card.value}</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">{card.hint}</p>
          </article>
        ))}
      </section>}

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-6">
          <section className="erp-card rounded-[30px] p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.4em] text-blue-600">Quick Launch</p>
                <h2 className="mt-3 text-3xl font-extrabold text-slate-900">Jump into the main workflows.</h2>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">Open the most-used parts of the app quickly from the dashboard while keeping the experience role-aware.</p>
              </div>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {[
                { label: "Open Exam Portal", hint: "Manage schedules, assignments, and reports", to: "/exam-portal" },
                { label: "Open Profile Center", hint: "Edit your reusable details and career story", to: "/profile" },
                { label: "Open Resume Builder", hint: "Create ATS resumes with profile-based prefill", to: "/dashboard/resume-builder" },
                { label: "Continue SQL Study", hint: "Resume the module from the last topic", to: "/study/sql" },
                { label: "Practice Arena", hint: "Solve coding and SQL questions", to: "/practice" },
              ].map((item) => (
                <button key={item.to} type="button" onClick={() => navigate(item.to)} className="rounded-[24px] border border-blue-100 bg-blue-50/60 p-5 text-left transition hover:-translate-y-0.5 hover:bg-blue-50">
                  <p className="text-lg font-bold text-slate-900">{item.label}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{item.hint}</p>
                </button>
              ))}
            </div>
          </section>

          {shellSettings.activityFeedEnabled && <section className="erp-card rounded-[30px] p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.4em] text-blue-600">Activity Feed</p>
            <h2 className="mt-3 text-2xl font-extrabold text-slate-900">Recent workspace activity</h2>
            <div className="mt-5 space-y-3">
              {analytics.activity.length === 0 ? (
                <div className="rounded-[24px] border border-dashed border-slate-200 px-5 py-6 text-sm text-slate-500">No recent activity yet. Save your profile, manage content, or update settings to build a real workspace trail here.</div>
              ) : analytics.activity.map((entry) => (
                <div key={entry.id} className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-bold text-slate-900">{entry.title}</p>
                    <span className="text-xs font-semibold text-slate-500">{new Date(entry.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{entry.message}</p>
                </div>
              ))}
            </div>
          </section>}
        </div>

        <div className="space-y-6">
          <section className="erp-card rounded-[30px] p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.4em] text-blue-600">Profile Strength</p>
            <h2 className="mt-3 text-2xl font-extrabold text-slate-900">Whole-app readiness</h2>
            <div className="mt-5 rounded-[24px] border border-blue-100 bg-blue-50/70 p-5">
              <p className="text-4xl font-extrabold text-slate-900">{analytics.resume.profileStrength}/6</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">Core profile areas completed. Stronger profile data improves resumes, dashboard analytics, and future recommendation features.</p>
            </div>
            <div className="mt-4 rounded-[24px] border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm font-bold text-slate-900">Active resume</p>
              <p className="mt-2 text-lg font-semibold text-slate-700">{analytics.resume.activeResumeName}</p>
              <button type="button" onClick={() => navigate("/dashboard/resume-builder")} className="mt-4 rounded-full bg-[#0F5BD8] px-5 py-2 text-sm font-semibold text-white">Manage Resume</button>
            </div>
          </section>

          {analytics.isPrivileged && (
            <section className="erp-card rounded-[30px] p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.4em] text-blue-600">Admin Tools</p>
              <h2 className="mt-3 text-2xl font-extrabold text-slate-900">Privileged controls</h2>
              <div className="mt-5 space-y-3">
                {adminCards.map((item) => (
                  <button key={item.to} type="button" onClick={() => navigate(item.to)} className="w-full rounded-[22px] border border-blue-100 bg-blue-50/60 px-5 py-4 text-left transition hover:bg-blue-50">
                    <p className="text-base font-bold text-slate-900">{item.label}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{item.hint}</p>
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
