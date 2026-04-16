import React, { useEffect, useMemo, useState } from "react";
import SaveStatusBadge from "../components/SaveStatusBadge";
import { getStoredUser, isPrivilegedRole } from "../utils/roleHelper";
import { canEditProfile, fetchProfileFromApi, readProfile, saveProfile, saveProfileToApi } from "../utils/profileStorage";
import { pushAppNotification } from "../utils/appNotifications";

const sectionCardClass = "erp-card rounded-[28px] p-5";

const emptyEducation = { degree: "", school: "", location: "", startDate: "", endDate: "", details: "" };
const emptySkill = { category: "", items: "" };
const emptyExperience = { role: "", company: "", location: "", startDate: "", endDate: "", achievements: "" };
const emptyProject = { name: "", tech: "", link: "", description: "" };

const basicsFields = [
  { key: "fullName", label: "Full Name" },
  { key: "headline", label: "Headline / Target Role" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone Number" },
  { key: "location", label: "Location" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "github", label: "GitHub" },
  { key: "portfolio", label: "Portfolio" },
];

const ProfileCenter = () => {
  const user = getStoredUser();
  const userId = user?.name || user?.role || "guest";
  const editable = canEditProfile(user);
  const [profile, setProfile] = useState(() => readProfile(userId));
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [importValue, setImportValue] = useState("");

  useEffect(() => {
    let mounted = true;
    const localProfile = readProfile(userId);
    setProfile(localProfile);
    fetchProfileFromApi(user?.id || 1)
      .then((remoteProfile) => {
        if (!mounted) return;
        saveProfile(userId, remoteProfile, { silent: true });
        setProfile(remoteProfile);
      })
      .catch(() => {});
    return () => { mounted = false; };
  }, [userId, user?.id]);

  const completionStats = useMemo(() => {
    const checks = [
      profile.basics.fullName,
      profile.basics.email,
      profile.basics.phone,
      profile.basics.location,
      profile.summary,
      profile.education?.[0]?.degree,
      profile.skills?.[0]?.items,
      profile.experience?.[0]?.role,
      profile.projects?.[0]?.name,
    ];
    const filled = checks.filter(Boolean).length;
    return { filled, total: checks.length, percent: Math.round((filled / checks.length) * 100) };
  }, [profile]);

  const exportProfile = () => {
    const blob = new Blob([JSON.stringify(profile, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "profile-center.json";
    link.click();
    URL.revokeObjectURL(url);
    pushAppNotification({ title: "Profile exported", message: "A reusable JSON copy of the profile was downloaded.", tone: "info", href: "/profile" });
  };

  const importProfile = () => {
    if (!editable || !importValue.trim()) return;
    try {
      const parsed = JSON.parse(importValue);
      persistProfile({ ...readProfile(userId), ...parsed, basics: { ...readProfile(userId).basics, ...(parsed.basics || {}) } });
      pushAppNotification({ title: "Profile imported", message: "Profile data was restored and synced.", tone: "success", href: "/profile" });
      setImportValue("");
    } catch {
      pushAppNotification({ title: "Profile import failed", message: "Please paste a valid profile JSON file.", tone: "danger", href: "/profile" });
    }
  };

  const persistProfile = (nextProfile) => {
    setProfile(nextProfile);
    saveProfile(userId, nextProfile, { silent: true });
    setLastSavedAt(new Date().toISOString());
    saveProfileToApi(user?.id || 1, nextProfile).catch(() => {});
  };

  const updateBasics = (key, value) => {
    if (!editable) return;
    persistProfile({ ...profile, basics: { ...profile.basics, [key]: value } });
  };

  const updateTopLevel = (key, value) => {
    if (!editable) return;
    persistProfile({ ...profile, [key]: value });
  };

  const updateListItem = (section, index, key, value) => {
    if (!editable) return;
    const nextItems = [...(profile[section] || [])];
    nextItems[index] = { ...nextItems[index], [key]: value };
    persistProfile({ ...profile, [section]: nextItems });
  };

  const addListItem = (section, factory) => {
    if (!editable) return;
    persistProfile({ ...profile, [section]: [...(profile[section] || []), factory] });
  };

  const summaryCards = [
    { label: "Profile strength", value: `${completionStats.percent}%`, hint: `${completionStats.filled}/${completionStats.total} core items filled` },
    { label: "Resume readiness", value: profile.summary ? "Ready" : "Needs summary", hint: "Summary feeds ATS templates directly" },
    { label: "Role access", value: isPrivilegedRole(user?.role) ? "Privileged" : "Student", hint: editable ? "Profile editing enabled" : "Read-only by settings" },
  ];

  return (
    <div className="space-y-6">
      <section className="erp-card rounded-[32px] px-6 py-8 md:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.45em] text-blue-600">Profile Center</p>
            <h1 className="mt-3 text-4xl font-extrabold text-slate-900">Keep one master profile for the whole app.</h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">
              Basic details, education, skills, projects, and career goals stay in one place and flow directly into the resume builder, dashboard insights, and future learning recommendations.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3"><SaveStatusBadge value={lastSavedAt} tone="success" /><button type="button" onClick={exportProfile} className="rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700">Export JSON</button></div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {summaryCards.map((card) => (
          <article key={card.label} className={sectionCardClass}>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-600">{card.label}</p>
            <p className="mt-4 text-3xl font-extrabold text-slate-900">{card.value}</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">{card.hint}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className={sectionCardClass}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-600">Basics</p>
              <h2 className="mt-2 text-2xl font-extrabold text-slate-900">Personal information</h2>
            </div>
            {!editable && <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">Read only</span>}
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {basicsFields.map((field) => (
              <label key={field.key} className="text-sm font-semibold text-slate-700">
                {field.label}
                <input
                  value={profile.basics[field.key] || ""}
                  disabled={!editable}
                  onChange={(event) => updateBasics(field.key, event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-blue-100 bg-[#f8fbff] px-4 py-3 text-sm font-medium text-slate-700 outline-none disabled:cursor-not-allowed disabled:bg-slate-100"
                />
              </label>
            ))}
          </div>
        </div>

        <div className={sectionCardClass}>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-600">Career Story</p>
          <h2 className="mt-2 text-2xl font-extrabold text-slate-900">Summary and goal</h2>
          <label className="mt-5 block text-sm font-semibold text-slate-700">
            Professional Summary
            <textarea
              value={profile.summary || ""}
              disabled={!editable}
              onChange={(event) => updateTopLevel("summary", event.target.value)}
              rows={6}
              className="mt-2 w-full rounded-2xl border border-blue-100 bg-[#f8fbff] px-4 py-3 text-sm font-medium text-slate-700 outline-none disabled:cursor-not-allowed disabled:bg-slate-100"
            />
          </label>
          <label className="mt-4 block text-sm font-semibold text-slate-700">
            Career Goal
            <textarea
              value={profile.careerGoal || ""}
              disabled={!editable}
              onChange={(event) => updateTopLevel("careerGoal", event.target.value)}
              rows={4}
              className="mt-2 w-full rounded-2xl border border-blue-100 bg-[#f8fbff] px-4 py-3 text-sm font-medium text-slate-700 outline-none disabled:cursor-not-allowed disabled:bg-slate-100"
            />
          </label>
        </div>
      </section>

      <section className="erp-card rounded-[28px] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-600">Profile Portability</p>
            <h2 className="mt-2 text-2xl font-extrabold text-slate-900">Import or restore profile data</h2>
          </div>
          {editable && <button type="button" onClick={importProfile} className="rounded-full bg-[#0F5BD8] px-4 py-2 text-sm font-bold text-white">Import JSON</button>}
        </div>
        <textarea value={importValue} onChange={(event) => setImportValue(event.target.value)} rows={6} placeholder="Paste profile-center.json here to restore basics, education, skills, and project data." className="mt-4 w-full rounded-[24px] border border-blue-100 bg-[#f8fbff] px-4 py-4 text-sm font-medium text-slate-700 outline-none disabled:bg-slate-100" disabled={!editable} />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className={sectionCardClass}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-600">Education</p>
              <h2 className="mt-2 text-2xl font-extrabold text-slate-900">Academic history</h2>
            </div>
            {editable && (
              <button type="button" onClick={() => addListItem("education", emptyEducation)} className="rounded-full bg-[#0F5BD8] px-4 py-2 text-sm font-bold text-white">
                Add Education
              </button>
            )}
          </div>
          <div className="mt-5 space-y-4">
            {(profile.education || []).map((item, index) => (
              <div key={`education-${index}`} className="rounded-[24px] border border-blue-100 bg-blue-50/40 p-4">
                <div className="grid gap-3 md:grid-cols-2">
                  {Object.entries(item).map(([key, value]) => (
                    <label key={key} className="text-sm font-semibold text-slate-700">
                      {key}
                      <input
                        value={value || ""}
                        disabled={!editable}
                        onChange={(event) => updateListItem("education", index, key, event.target.value)}
                        className="mt-2 w-full rounded-2xl border border-white bg-white px-4 py-3 text-sm font-medium text-slate-700 outline-none disabled:cursor-not-allowed disabled:bg-slate-100"
                      />
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={sectionCardClass}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-600">Skills</p>
              <h2 className="mt-2 text-2xl font-extrabold text-slate-900">Technical and soft skills</h2>
            </div>
            {editable && (
              <button type="button" onClick={() => addListItem("skills", emptySkill)} className="rounded-full bg-[#0F5BD8] px-4 py-2 text-sm font-bold text-white">
                Add Skill Group
              </button>
            )}
          </div>
          <div className="mt-5 space-y-4">
            {(profile.skills || []).map((item, index) => (
              <div key={`skills-${index}`} className="rounded-[24px] border border-blue-100 bg-blue-50/40 p-4">
                <label className="block text-sm font-semibold text-slate-700">
                  Category
                  <input value={item.category || ""} disabled={!editable} onChange={(event) => updateListItem("skills", index, "category", event.target.value)} className="mt-2 w-full rounded-2xl border border-white bg-white px-4 py-3 text-sm font-medium text-slate-700 outline-none disabled:bg-slate-100" />
                </label>
                <label className="mt-3 block text-sm font-semibold text-slate-700">
                  Skills
                  <textarea value={item.items || ""} disabled={!editable} onChange={(event) => updateListItem("skills", index, "items", event.target.value)} rows={4} className="mt-2 w-full rounded-2xl border border-white bg-white px-4 py-3 text-sm font-medium text-slate-700 outline-none disabled:bg-slate-100" />
                </label>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className={sectionCardClass}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-600">Experience</p>
              <h2 className="mt-2 text-2xl font-extrabold text-slate-900">Work and internships</h2>
            </div>
            {editable && (
              <button type="button" onClick={() => addListItem("experience", emptyExperience)} className="rounded-full bg-[#0F5BD8] px-4 py-2 text-sm font-bold text-white">
                Add Experience
              </button>
            )}
          </div>
          <div className="mt-5 space-y-4">
            {(profile.experience || []).map((item, index) => (
              <div key={`experience-${index}`} className="rounded-[24px] border border-blue-100 bg-blue-50/40 p-4">
                {Object.entries(item).map(([key, value]) => (
                  <label key={key} className="mt-3 block text-sm font-semibold text-slate-700 first:mt-0">
                    {key}
                    {key === "achievements" ? (
                      <textarea value={value || ""} disabled={!editable} onChange={(event) => updateListItem("experience", index, key, event.target.value)} rows={4} className="mt-2 w-full rounded-2xl border border-white bg-white px-4 py-3 text-sm font-medium text-slate-700 outline-none disabled:bg-slate-100" />
                    ) : (
                      <input value={value || ""} disabled={!editable} onChange={(event) => updateListItem("experience", index, key, event.target.value)} className="mt-2 w-full rounded-2xl border border-white bg-white px-4 py-3 text-sm font-medium text-slate-700 outline-none disabled:bg-slate-100" />
                    )}
                  </label>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className={sectionCardClass}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-600">Projects</p>
              <h2 className="mt-2 text-2xl font-extrabold text-slate-900">Portfolio-ready work</h2>
            </div>
            {editable && (
              <button type="button" onClick={() => addListItem("projects", emptyProject)} className="rounded-full bg-[#0F5BD8] px-4 py-2 text-sm font-bold text-white">
                Add Project
              </button>
            )}
          </div>
          <div className="mt-5 space-y-4">
            {(profile.projects || []).map((item, index) => (
              <div key={`projects-${index}`} className="rounded-[24px] border border-blue-100 bg-blue-50/40 p-4">
                {Object.entries(item).map(([key, value]) => (
                  <label key={key} className="mt-3 block text-sm font-semibold text-slate-700 first:mt-0">
                    {key}
                    {key === "description" ? (
                      <textarea value={value || ""} disabled={!editable} onChange={(event) => updateListItem("projects", index, key, event.target.value)} rows={4} className="mt-2 w-full rounded-2xl border border-white bg-white px-4 py-3 text-sm font-medium text-slate-700 outline-none disabled:bg-slate-100" />
                    ) : (
                      <input value={value || ""} disabled={!editable} onChange={(event) => updateListItem("projects", index, key, event.target.value)} className="mt-2 w-full rounded-2xl border border-white bg-white px-4 py-3 text-sm font-medium text-slate-700 outline-none disabled:bg-slate-100" />
                    )}
                  </label>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default ProfileCenter;
