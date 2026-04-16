import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { RESUME_TEMPLATES, getResumeTemplateById } from "../data/resumeTemplates";
import { analyzeResumeAgainstJob } from "../utils/atsChecker";
import { getStoredUser, isPrivilegedRole } from "../utils/roleHelper";
import {
  MAX_RESUMES_PER_USER,
  cloneResumeData,
  createDefaultAdvancedStyle,
  createEmptyResumeFromProfile,
  newResumeEntryFactories,
  readResumeWorkspace,
  saveResumeWorkspace,
} from "../utils/resumeBuilderStorage";
import { getResumeSettings } from "../utils/resumeSettings";

const SECTION_META = {
  summary: {
    label: "Professional Summary / Objective",
    kind: "text",
    placeholder: "Write a 2-4 line summary about your skills, goals, and impact.",
  },
  education: {
    label: "Education",
    kind: "list",
    addLabel: "Add Education",
    fields: [
      { key: "degree", label: "Degree" },
      { key: "school", label: "Institution Name" },
      { key: "location", label: "Location" },
      { key: "startDate", label: "Start Year" },
      { key: "endDate", label: "Year of Graduation" },
      { key: "details", label: "CGPA / Percentage / Highlights", type: "textarea" },
    ],
  },
  experience: {
    label: "Work Experience",
    kind: "list",
    addLabel: "Add Experience",
    fields: [
      { key: "role", label: "Job Title" },
      { key: "company", label: "Company Name" },
      { key: "location", label: "Location" },
      { key: "startDate", label: "Start Date" },
      { key: "endDate", label: "End Date" },
      { key: "achievements", label: "Responsibilities / Achievements", type: "textarea" },
    ],
  },
  internships: {
    label: "Internships",
    kind: "list",
    addLabel: "Add Internship",
    fields: [
      { key: "role", label: "Internship Role" },
      { key: "company", label: "Company Name" },
      { key: "location", label: "Location" },
      { key: "startDate", label: "Start Date" },
      { key: "endDate", label: "End Date" },
      { key: "achievements", label: "Responsibilities / Achievements", type: "textarea" },
    ],
  },
  projects: {
    label: "Projects",
    kind: "list",
    addLabel: "Add Project",
    fields: [
      { key: "name", label: "Project Title" },
      { key: "description", label: "Description", type: "textarea" },
      { key: "tech", label: "Tech Stack" },
      { key: "link", label: "GitHub / Live Link" },
    ],
  },
  skills: {
    label: "Skills",
    kind: "list",
    addLabel: "Add Skill Group",
    fields: [
      { key: "category", label: "Skill Type" },
      { key: "items", label: "Skills", type: "textarea" },
    ],
  },
  certifications: {
    label: "Certifications",
    kind: "list",
    addLabel: "Add Certification",
    fields: [
      { key: "name", label: "Certification Name" },
      { key: "issuer", label: "Issuing Organization" },
      { key: "year", label: "Year" },
    ],
  },
  achievements: {
    label: "Achievements / Awards",
    kind: "list",
    addLabel: "Add Achievement",
    fields: [
      { key: "title", label: "Title" },
      { key: "detail", label: "Competition / Rank / Recognition", type: "textarea" },
    ],
  },
  languages: {
    label: "Languages",
    kind: "list",
    addLabel: "Add Language",
    fields: [
      { key: "name", label: "Language" },
      { key: "proficiency", label: "Level" },
    ],
  },
  publications: {
    label: "Publications",
    kind: "list",
    addLabel: "Add Publication",
    fields: [
      { key: "title", label: "Publication Title" },
      { key: "publisher", label: "Publisher / Journal" },
      { key: "year", label: "Year" },
      { key: "detail", label: "Details", type: "textarea" },
    ],
  },
  volunteerExperience: {
    label: "Volunteer Experience",
    kind: "list",
    addLabel: "Add Volunteer Work",
    fields: [
      { key: "organization", label: "Organization" },
      { key: "role", label: "Role" },
      { key: "duration", label: "Duration" },
      { key: "detail", label: "Details", type: "textarea" },
    ],
  },
  hobbies: {
    label: "Hobbies / Interests",
    kind: "list",
    addLabel: "Add Hobby / Interest",
    fields: [
      { key: "title", label: "Title" },
      { key: "detail", label: "Description", type: "textarea" },
    ],
  },
  references: {
    label: "References",
    kind: "list",
    addLabel: "Add Reference",
    fields: [
      { key: "name", label: "Reference Name" },
      { key: "designation", label: "Designation" },
      { key: "contact", label: "Contact" },
    ],
  },
  customSections: {
    label: "Custom Section",
    kind: "list",
    addLabel: "Add Custom Section",
    fields: [
      { key: "title", label: "Custom Title" },
      { key: "content", label: "Content", type: "textarea" },
    ],
  },
};

const PROFILE_FIELDS = [
  { key: "fullName", label: "Full Name" },
  { key: "phone", label: "Phone Number" },
  { key: "email", label: "Email" },
  { key: "location", label: "Location (City, Country)" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "portfolio", label: "Portfolio" },
  { key: "github", label: "GitHub" },
  { key: "headline", label: "Headline / Target Role" },
];

const FIELD_GROUPS = [
  { id: "core", title: "Core Resume Sections", sectionIds: ["summary", "experience", "education", "skills"] },
  { id: "important", title: "Important Optional Sections", sectionIds: ["projects", "certifications", "achievements", "internships", "languages"] },
  { id: "advanced", title: "Advanced / Custom Sections", sectionIds: ["publications", "volunteerExperience", "hobbies", "references", "customSections"] },
];

const TEMPLATE_SAMPLE_RESUME = {
  basics: {
    fullName: "Aarav Sharma",
    headline: "Software Engineer",
    phone: "+91 98765 43210",
    email: "aarav.sharma@email.com",
    location: "Hyderabad, India",
    linkedin: "linkedin.com/in/aaravsharma",
    github: "github.com/aaravsharma",
    portfolio: "aarav.dev",
  },
  summary:
    "Detail-oriented software engineer with strong SQL, React, and backend fundamentals. Built academic and internship projects with measurable impact and recruiter-friendly documentation.",
  experience: [
    {
      role: "Frontend Intern",
      company: "TechNova Labs",
      location: "Remote",
      startDate: "Jan 2025",
      endDate: "Apr 2025",
      achievements: "Built reusable dashboard components and improved page load speed by 28%.",
    },
  ],
  education: [
    {
      degree: "B.Tech in Computer Science",
      school: "ABC Institute of Technology",
      location: "Hyderabad",
      startDate: "2021",
      endDate: "2025",
      details: "CGPA: 8.7/10",
    },
  ],
  skills: [
    {
      category: "Technical Skills",
      items: "SQL, Python, React, JavaScript, FastAPI, Git",
    },
  ],
  projects: [
    {
      name: "ATS Resume Builder",
      tech: "React, Tailwind, Local Storage",
      link: "github.com/aaravsharma/resume-builder",
      description: "Created an interactive resume editor with template switching and export support.",
    },
  ],
};

const ACCENT_COLOR_OPTIONS = [
  { label: "Royal Blue", value: "#0F5BD8" },
  { label: "Emerald", value: "#0F9D7A" },
  { label: "Ruby", value: "#C2415D" },
  { label: "Amber", value: "#B7791F" },
  { label: "Slate", value: "#334155" },
  { label: "Indigo", value: "#4F46E5" },
];

const RESUME_FONT_OPTIONS = [
  { label: "Arial", value: "Arial, sans-serif" },
  { label: "Helvetica", value: "Helvetica, Arial, sans-serif" },
  { label: "Verdana", value: "Verdana, Geneva, sans-serif" },
  { label: "Tahoma", value: "Tahoma, Geneva, sans-serif" },
  { label: "Trebuchet MS", value: "'Trebuchet MS', Helvetica, sans-serif" },
  { label: "Calibri", value: "Calibri, Candara, Segoe, sans-serif" },
  { label: "Cambria", value: "Cambria, Georgia, serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Garamond", value: "Garamond, Baskerville, serif" },
  { label: "Palatino", value: "'Palatino Linotype', Palatino, serif" },
  { label: "Book Antiqua", value: "'Book Antiqua', Palatino, serif" },
  { label: "Times New Roman", value: "'Times New Roman', Times, serif" },
  { label: "Segoe UI", value: "'Segoe UI', Tahoma, sans-serif" },
  { label: "Gill Sans", value: "'Gill Sans', 'Gill Sans MT', Calibri, sans-serif" },
  { label: "Century Gothic", value: "'Century Gothic', Futura, sans-serif" },
];

const inputClassName =
  "mt-2 w-full rounded-2xl border border-blue-100 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100";

const getStorageId = (user) => user?.id || user?.email || user?.name || "guest";

const hasContent = (value) => {
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.some((item) => Object.values(item || {}).some((entry) => hasContent(entry)));
  if (value && typeof value === "object") return Object.values(value).some((entry) => hasContent(entry));
  return Boolean(value);
};

const buildSectionTitle = (sectionId, item) =>
  item?.title || item?.role || item?.name || item?.degree || item?.category || SECTION_META[sectionId]?.label;

const readOnlyLine = (label, value) => (
  <div key={label} className="rounded-[20px] border border-blue-100 bg-slate-50 px-4 py-3">
    <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-400">{label}</p>
    <p className="mt-2 text-sm font-semibold text-slate-700">{value || "Not added yet"}</p>
  </div>
);

const FieldInput = ({ label, value, onChange, type = "text", disabled = false }) => (
  <label className="block">
    <span className="text-sm font-semibold text-slate-700">{label}</span>
    {type === "textarea" ? (
      <textarea
        rows={4}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className={`${inputClassName} min-h-[108px] resize-y disabled:bg-slate-100 disabled:text-slate-500`}
      />
    ) : (
      <input
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className={`${inputClassName} disabled:bg-slate-100 disabled:text-slate-500`}
      />
    )}
  </label>
);

const fieldValueSummary = (sectionId, item) => {
  switch (sectionId) {
    case "education":
      return [item.school, item.location, item.startDate && item.endDate ? `${item.startDate} - ${item.endDate}` : item.endDate || item.startDate]
        .filter(Boolean)
        .join(" | ");
    case "experience":
    case "internships":
      return [item.company, item.location, item.startDate && item.endDate ? `${item.startDate} - ${item.endDate}` : item.endDate || item.startDate]
        .filter(Boolean)
        .join(" | ");
    case "projects":
      return [item.tech, item.link].filter(Boolean).join(" | ");
    case "skills":
      return item.items;
    case "certifications":
      return [item.issuer, item.year].filter(Boolean).join(" | ");
    case "achievements":
      return item.detail;
    case "languages":
      return item.proficiency;
    case "publications":
      return [item.publisher, item.year].filter(Boolean).join(" | ");
    case "volunteerExperience":
      return [item.organization, item.duration].filter(Boolean).join(" | ");
    case "hobbies":
      return item.detail;
    case "references":
      return [item.designation, item.contact].filter(Boolean).join(" | ");
    case "customSections":
      return item.content;
    default:
      return "";
  }
};

const InlineTextEditor = ({ value, onChange, placeholder, className = "" }) => (
  <textarea
    rows={4}
    value={value}
    onChange={(event) => onChange(event.target.value)}
    placeholder={placeholder}
    className={`w-full resize-none border-0 bg-transparent p-0 text-sm leading-7 text-slate-700 outline-none ring-0 placeholder:text-slate-400 ${className}`}
  />
);

const InlineItemEditor = ({ meta, item, onChange }) => (
  <div className="grid gap-3 md:grid-cols-2">
    {meta.fields.map((field) => (
      <label key={field.key} className={field.type === "textarea" ? "md:col-span-2" : ""}>
        <span className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-400">{field.label}</span>
        {field.type === "textarea" ? (
          <textarea
            rows={4}
            value={item[field.key] || ""}
            onChange={(event) => onChange(field.key, event.target.value)}
            className="mt-2 min-h-[92px] w-full resize-y rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-400"
          />
        ) : (
          <input
            value={item[field.key] || ""}
            onChange={(event) => onChange(field.key, event.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-400"
          />
        )}
      </label>
    ))}
  </div>
);

const TemplatePreviewCard = ({ template, active, onClick }) => {
  const sample = TEMPLATE_SAMPLE_RESUME;
  const centered = template.variant === "helsinki" || template.variant === "accentRibbon";
  const accent = template.supportsAccentColor ? "#0F5BD8" : "#64748b";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[28px] border p-5 text-left transition ${
        active ? "border-blue-500 bg-blue-50 shadow-sm" : "border-blue-100 bg-white hover:border-blue-300"
      }`}
    >
      <p className="text-lg font-bold text-slate-900">{template.name}</p>
      <p className="mt-2 text-sm leading-6 text-slate-500">{template.description}</p>
      <div className={`mt-5 overflow-hidden rounded-[24px] border ${template.palette.border} ${template.palette.page} p-3`}>
        <div className={`rounded-[20px] border ${template.palette.border} ${template.palette.sheet} px-4 py-4`}>
          {template.variant === "accentRibbon" ? (
            <div className="mb-4 h-2 rounded-full" style={{ backgroundColor: accent }} />
          ) : null}
          <div className={centered ? "text-center" : ""}>
            <h4 className="text-[13px] font-semibold tracking-[0.08em] text-slate-900">{sample.basics.fullName}</h4>
            <p className="mt-1 text-[9px] uppercase tracking-[0.18em]" style={{ color: template.variant === "accentRibbon" ? accent : "#64748b" }}>
              {sample.basics.headline}
            </p>
            <div className={`mt-3 border-t ${template.palette.rule}`} />
            <p className="mt-2 text-[8px] leading-4 text-slate-500">
              {sample.basics.phone} | {sample.basics.email}
            </p>
          </div>
          <div className="mt-3">
            <div className={`border-t ${template.palette.rule} pt-2`}>
              <p className={`text-[10px] font-semibold ${template.variant === "cleanEdge" || template.variant === "accentRibbon" ? "uppercase tracking-[0.16em]" : ""}`} style={{ color: template.variant === "accentRibbon" ? accent : "#0f172a" }}>
                Professional Summary
              </p>
              <p className="mt-1 text-[8px] leading-4 text-slate-600">
                {sample.summary.slice(0, 115)}...
              </p>
            </div>
            <div className={`mt-3 border-t ${template.palette.rule} pt-2`}>
              <p className={`text-[10px] font-semibold ${template.variant === "cleanEdge" || template.variant === "accentRibbon" ? "uppercase tracking-[0.16em]" : ""}`} style={{ color: template.variant === "accentRibbon" ? accent : "#0f172a" }}>
                Skills
              </p>
              <p className="mt-1 text-[8px] leading-4 text-slate-600">{sample.skills[0].items}</p>
            </div>
            <div className={`mt-3 border-t ${template.palette.rule} pt-2`}>
              <p className={`text-[10px] font-semibold ${template.variant === "cleanEdge" || template.variant === "accentRibbon" ? "uppercase tracking-[0.16em]" : ""}`} style={{ color: template.variant === "accentRibbon" ? accent : "#0f172a" }}>
                Work Experience
              </p>
              <p className="mt-1 text-[8px] font-semibold text-slate-800">
                {sample.experience[0].role} | {sample.experience[0].company}
              </p>
              <p className="mt-1 text-[8px] leading-4 text-slate-600">{sample.experience[0].achievements}</p>
            </div>
          </div>
        </div>
      </div>
      <p className="mt-3 text-xs uppercase tracking-[0.22em] text-slate-400">{template.preview}</p>
    </button>
  );
};

const AdvancedControl = ({ label, value, onChange, min, max, suffix = "", step = 1 }) => (
  <label className="block">
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      <span className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">
        {value}
        {suffix}
      </span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
      className="mt-3 w-full accent-[#0F5BD8]"
    />
  </label>
);

const ResumeBuilder = () => {
  const navigate = useNavigate();
  const user = getStoredUser();
  const resumeExportRef = useRef(null);
  const storageId = useMemo(() => getStorageId(user), [user]);
  const canManageProfileEdit = isPrivilegedRole(user?.role);
  const [workspace, setWorkspace] = useState(() => readResumeWorkspace(storageId));
  const [resumeSettings, setResumeSettings] = useState(() => getResumeSettings());
  const [currentView, setCurrentView] = useState("portal");
  const [draftResume, setDraftResume] = useState(null);
  const [templateChoice, setTemplateChoice] = useState(RESUME_TEMPLATES[0].id);
  const [portalMode, setPortalMode] = useState("new");
  const [sourceResumeId, setSourceResumeId] = useState("");
  const [editingProfile, setEditingProfile] = useState(false);
  const [editingBasics, setEditingBasics] = useState(false);
  const [editingSummary, setEditingSummary] = useState(false);
  const [sectionEditMap, setSectionEditMap] = useState({});
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [downloadPreviewOpen, setDownloadPreviewOpen] = useState(false);
  const [atsJobDescription, setAtsJobDescription] = useState("");
  const [atsSelectedResumeId, setAtsSelectedResumeId] = useState("");
  const [atsResult, setAtsResult] = useState(null);
  const previewExportRef = useRef(null);

  useEffect(() => {
    setWorkspace(readResumeWorkspace(storageId));
  }, [storageId]);

  useEffect(() => {
    saveResumeWorkspace(storageId, workspace);
  }, [storageId, workspace]);

  useEffect(() => {
    const sync = (event) => setResumeSettings(event.detail || getResumeSettings());
    window.addEventListener("resume-settings-updated", sync);
    return () => window.removeEventListener("resume-settings-updated", sync);
  }, []);

  const profileEditAllowed = canManageProfileEdit || resumeSettings.studentProfileEditEnabled;
  const activeTemplate = getResumeTemplateById(draftResume?.templateId || templateChoice);
  const atsSelectedResume =
    workspace.resumes.find((resume) => resume.id === atsSelectedResumeId) || workspace.resumes[0] || null;

  const syncWorkspace = (updater) => {
    setWorkspace((current) => (typeof updater === "function" ? updater(current) : updater));
  };

  const updateProfileBasics = (key, value) => {
    syncWorkspace((current) => ({
      ...current,
      profile: {
        ...current.profile,
        basics: { ...current.profile.basics, [key]: value },
      },
    }));
  };

  const updateProfileSection = (sectionId, value) => {
    syncWorkspace((current) => ({
      ...current,
      profile: { ...current.profile, [sectionId]: value },
    }));
  };

  const startNewDraft = (mode) => {
    if (workspace.resumes.length >= MAX_RESUMES_PER_USER && mode === "new") return;
    const baseResume =
      mode === "load" && sourceResumeId
        ? workspace.resumes.find((resume) => resume.id === sourceResumeId)
        : null;
    const nextDraft = baseResume
      ? {
          ...cloneResumeData(baseResume),
          id: `resume-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name: `${baseResume.name} Copy`,
          templateId: templateChoice,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
      : createEmptyResumeFromProfile(workspace.profile, workspace.resumes.length);

    if (!baseResume) {
      nextDraft.templateId = templateChoice;
      nextDraft.content.basics = cloneResumeData(workspace.profile.basics);
    }

    setDraftResume(nextDraft);
    setEditingBasics(false);
    setEditingSummary(false);
    setSectionEditMap({});
    setCurrentView("builder");
  };

  const openSavedResume = (resume) => {
    setDraftResume(cloneResumeData(resume));
    setEditingBasics(false);
    setEditingSummary(false);
    setSectionEditMap({});
    setCurrentView("builder");
  };

  const saveDraftResume = () => {
    if (!draftResume) return;
    syncWorkspace((current) => {
      const existingIndex = current.resumes.findIndex((resume) => resume.id === draftResume.id);
      const nextResume = { ...draftResume, updatedAt: new Date().toISOString() };
      if (existingIndex >= 0) {
        const nextResumes = current.resumes.map((resume) => (resume.id === nextResume.id ? nextResume : resume));
        return { ...current, resumes: nextResumes, activeResumeId: nextResume.id };
      }
      if (current.resumes.length >= MAX_RESUMES_PER_USER) return current;
      return {
        ...current,
        resumes: [...current.resumes, nextResume],
        activeResumeId: nextResume.id,
      };
    });
    setCurrentView("portal");
  };

  const deleteResume = (resumeId) => {
    syncWorkspace((current) => {
      const nextResumes = current.resumes.filter((resume) => resume.id !== resumeId);
      return {
        ...current,
        resumes: nextResumes,
        activeResumeId: nextResumes[0]?.id || null,
      };
    });
    if (draftResume?.id === resumeId) {
      setDraftResume(null);
      setCurrentView("portal");
    }
  };

  const updateDraftBasics = (key, value) =>
    setDraftResume((current) => ({
      ...current,
      content: {
        ...current.content,
        basics: { ...current.content.basics, [key]: value },
      },
    }));

  const updateDraftSection = (sectionId, value) =>
    setDraftResume((current) => ({
      ...current,
      content: { ...current.content, [sectionId]: value },
    }));

  const updateAdvancedStyle = (key, value) =>
    setDraftResume((current) => ({
      ...current,
      advancedStyle: {
        ...createDefaultAdvancedStyle(),
        ...(current.advancedStyle || {}),
        [key]: value,
      },
    }));

  const addSectionToDraft = (sectionId) => {
    if (!draftResume) return;
    setDraftResume((current) => {
      if (current.sectionOrder.includes(sectionId)) return current;
      return { ...current, sectionOrder: [...current.sectionOrder, sectionId] };
    });
  };

  const moveDraftSection = (sectionId, direction) => {
    setDraftResume((current) => {
      const index = current.sectionOrder.indexOf(sectionId);
      if (index < 0) return current;
      const target = direction === "up" ? index - 1 : index + 1;
      if (target < 0 || target >= current.sectionOrder.length) return current;
      const next = [...current.sectionOrder];
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved);
      return { ...current, sectionOrder: next };
    });
  };

  const removeSectionFromDraft = (sectionId) => {
    setDraftResume((current) => ({
      ...current,
      sectionOrder: current.sectionOrder.filter((entry) => entry !== sectionId),
    }));
  };

  const addEntry = (sectionId) =>
    updateDraftSection(sectionId, [...(draftResume.content[sectionId] || []), newResumeEntryFactories[sectionId]()]);

  const updateEntry = (sectionId, index, key, value) =>
    updateDraftSection(
      sectionId,
      (draftResume.content[sectionId] || []).map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item,
      ),
    );

  const removeEntry = (sectionId, index) =>
    updateDraftSection(
      sectionId,
      (draftResume.content[sectionId] || []).filter((_, itemIndex) => itemIndex !== index),
    );

  const toggleEdit = (sectionId, value) => setSectionEditMap((current) => ({ ...current, [sectionId]: value }));

  const exportMarkup = () => {
    if (!draftResume) return "";
    const basics = draftResume.content.basics || {};
    const template = getResumeTemplateById(draftResume.templateId);
    const style = { ...createDefaultAdvancedStyle(), ...(draftResume.advancedStyle || {}) };
    const accentColor = template.supportsAccentColor ? style.accentColor : "#0F5BD8";
    const headerAlign = template.variant === "cleanEdge" ? "left" : "center";
    const sectionHeadingText =
      style.sectionCase === "upper" ? (text) => text.toUpperCase() : style.sectionCase === "lower" ? (text) => text.toLowerCase() : (text) => text;
    const sectionRule = `margin:${Math.max(10, style.sectionSpacing - 6)}px ${style.dividerInset}px 10px;border-top:${style.dividerThickness}px solid #cbd5e1;`;
    return `
      <div style="padding:${style.pagePadding}px;background:#ffffff;font-family:${style.fontFamily};color:#0f172a;">
        ${template.variant === "accentRibbon" ? `<div style="height:10px;border-radius:999px;background:${accentColor};margin-bottom:22px;"></div>` : ""}
        <div style="text-align:${headerAlign};">
          <h1 style="margin:0;font-size:${style.nameSize}px;letter-spacing:${template.variant === "cleanEdge" ? "0.02em" : "0.08em"};">${basics.fullName || "Your Name"}</h1>
          <p style="margin:${Math.max(6, style.headerSpacing / 2)}px 0 0;color:${template.variant === "accentRibbon" ? accentColor : "#475569"};font-size:${Math.max(11, style.bodySize - 1)}px;text-transform:uppercase;letter-spacing:0.2em;">${basics.headline || ""}</p>
          <div style="margin:${style.contactSpacing}px ${style.dividerInset}px ${Math.max(12, style.contactSpacing + 2)}px;border-top:${style.dividerThickness}px solid #cbd5e1;"></div>
          <p style="margin:0 0 ${style.headerSpacing}px;color:#475569;font-size:${Math.max(12, style.bodySize - 1)}px;">${[
          basics.phone,
          basics.email,
          basics.location,
          basics.linkedin,
          basics.portfolio,
          basics.github,
        ]
          .filter(Boolean)
          .join(" | ")}</p>
        </div>
        ${draftResume.sectionOrder
          .map((sectionId) => {
            const meta = SECTION_META[sectionId];
            const value = draftResume.content[sectionId];
            if (!hasContent(value)) return "";
            if (meta.kind === "text") {
              return `<div style="${sectionRule}"></div><h2 style="margin:0 0 10px;font-size:${style.sectionTitleSize}px;${template.variant === "cleanEdge" || template.variant === "accentRibbon" || style.sectionCase === "upper" ? "text-transform:uppercase;letter-spacing:0.2em;" : ""}color:${template.variant === "accentRibbon" ? accentColor : "#111827"};">${sectionHeadingText(meta.label)}</h2><p style="margin:0;font-size:${style.bodySize}px;line-height:1.8;color:#334155;">${value}</p>`;
            }
            return `<div style="${sectionRule}"></div><h2 style="margin:0 0 10px;font-size:${style.sectionTitleSize}px;${template.variant === "cleanEdge" || template.variant === "accentRibbon" || style.sectionCase === "upper" ? "text-transform:uppercase;letter-spacing:0.2em;" : ""}color:${template.variant === "accentRibbon" ? accentColor : "#111827"};">${sectionHeadingText(meta.label)}</h2>${(value || [])
              .filter((item) => hasContent(item))
              .map(
                (item) =>
                  `<div style="margin-bottom:${style.itemSpacing}px;"><strong style="font-size:${Math.max(14, style.bodySize + 1)}px;">${buildSectionTitle(sectionId, item) || meta.label}</strong><div style="font-size:${Math.max(12, style.bodySize - 1)}px;color:#475569;margin-top:4px;">${fieldValueSummary(sectionId, item)}</div></div>`,
              )
              .join("")}`;
          })
          .join("")}
      </div>
    `;
  };

  const downloadWord = () => {
    const html = `<!DOCTYPE html><html><body>${exportMarkup()}</body></html>`;
    const blob = new Blob([html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${(draftResume?.name || "resume").replace(/\s+/g, "-").toLowerCase()}.doc`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadPdf = () => {
    const target = previewExportRef.current || resumeExportRef.current;
    if (!target) return;
    const filename = `${(draftResume?.name || "resume").replace(/\s+/g, "-").toLowerCase()}.pdf`;
    import("html2pdf.js").then(({ default: html2pdf }) => {
      html2pdf()
        .set({
          margin: [8, 8, 8, 8],
          filename,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: {
            scale: 2,
            useCORS: true,
            backgroundColor: "#ffffff",
          },
          jsPDF: {
            unit: "mm",
            format: "a4",
            orientation: "portrait",
          },
          pagebreak: {
            mode: ["css", "legacy"],
          },
        })
        .from(target)
        .save();
    });
  };

  const activeAdvancedStyle = { ...createDefaultAdvancedStyle(), ...(draftResume?.advancedStyle || {}) };
  const activeAccentColor = activeTemplate.supportsAccentColor ? activeAdvancedStyle.accentColor : "#0F5BD8";

  const runAtsCheck = () => {
    if (!atsSelectedResume || !atsJobDescription.trim()) return;
    setAtsResult(analyzeResumeAgainstJob(atsSelectedResume, atsJobDescription));
  };

  return (
    <div className="space-y-6">
      <section className="erp-card erp-grid-bg rounded-[32px] px-6 py-8 md:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.4em] text-blue-600">Resume Builder</p>
            <h1 className="mt-3 text-4xl font-extrabold text-slate-900">Advanced resume portal</h1>
            <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-600">
              Choose a template, create a new resume or load an old one, then build it using the left section library
              and the right live resume canvas.
            </p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => navigate("/dashboard")} className="rounded-full border border-blue-200 bg-white px-4 py-2 text-sm font-bold text-blue-700">
              Back to Dashboard
            </button>
            <button type="button" onClick={() => setCurrentView("ats")} className="rounded-full border border-blue-200 bg-white px-4 py-2 text-sm font-bold text-blue-700">
              ATS Checker
            </button>
            <button type="button" onClick={() => setCurrentView("profile")} className="rounded-full bg-[#0F5BD8] px-4 py-2 text-sm font-bold text-white">
              Profile
            </button>
          </div>
        </div>
      </section>

      {currentView === "portal" ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_360px]">
          <section className="erp-card rounded-[30px] p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-blue-100 pb-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.3em] text-blue-600">Before Entering Builder</p>
                <h2 className="mt-2 text-2xl font-extrabold text-slate-900">Preview the templates first</h2>
              </div>
              <div className="rounded-full bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700">
                Saved: {workspace.resumes.length}/{MAX_RESUMES_PER_USER}
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {RESUME_TEMPLATES.map((template) => (
                <TemplatePreviewCard
                  key={template.id}
                  template={template}
                  active={templateChoice === template.id}
                  onClick={() => setTemplateChoice(template.id)}
                />
              ))}
            </div>
          </section>

          <section className="space-y-6">
            <div className="erp-card rounded-[30px] p-6">
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-blue-600">Create / Load</p>
              <div className="mt-4 flex gap-2">
                <button type="button" onClick={() => setPortalMode("new")} className={`rounded-full px-4 py-2 text-sm font-bold ${portalMode === "new" ? "bg-[#0F5BD8] text-white" : "bg-blue-50 text-blue-700"}`}>
                  Create New
                </button>
                <button type="button" onClick={() => setPortalMode("load")} className={`rounded-full px-4 py-2 text-sm font-bold ${portalMode === "load" ? "bg-[#0F5BD8] text-white" : "bg-blue-50 text-blue-700"}`}>
                  Load Old
                </button>
              </div>
              <p className="mt-4 text-sm leading-7 text-slate-600">
                New resumes start with basic profile data and an empty structure. Load old copies an existing saved
                resume into the selected template.
              </p>
              {portalMode === "load" ? (
                <select value={sourceResumeId} onChange={(event) => setSourceResumeId(event.target.value)} className={inputClassName}>
                  <option value="">Select a saved resume</option>
                  {workspace.resumes.map((resume) => (
                    <option key={resume.id} value={resume.id}>
                      {resume.name}
                    </option>
                  ))}
                </select>
              ) : null}
              <button
                type="button"
                onClick={() => startNewDraft(portalMode)}
                disabled={(portalMode === "new" && workspace.resumes.length >= MAX_RESUMES_PER_USER) || (portalMode === "load" && !sourceResumeId)}
                className="mt-5 w-full rounded-[20px] bg-[#0F5BD8] px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                Open Builder
              </button>
              {workspace.resumes.length >= MAX_RESUMES_PER_USER ? (
                <p className="mt-3 text-sm font-semibold text-rose-600">Maximum 3 saved resumes reached. Delete one to create another.</p>
              ) : null}
            </div>

            <div className="erp-card rounded-[30px] p-6">
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-blue-600">Saved Resumes</p>
              <div className="mt-4 space-y-3">
                {workspace.resumes.map((resume) => (
                  <div key={resume.id} className="rounded-[24px] border border-blue-100 bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-slate-900">{resume.name}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.22em] text-slate-400">{getResumeTemplateById(resume.templateId).name}</p>
                      </div>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => openSavedResume(resume)} className="rounded-full border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700">
                          Open
                        </button>
                        <button type="button" onClick={() => deleteResume(resume.id)} className="rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-600">
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {currentView === "profile" ? (
        <section className="erp-card rounded-[30px] p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-blue-100 pb-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-blue-600">Profile</p>
              <h2 className="mt-2 text-2xl font-extrabold text-slate-900">Basic details that prefill resumes</h2>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setCurrentView("portal")} className="rounded-full border border-blue-200 bg-white px-4 py-2 text-sm font-bold text-blue-700">
                Back to Portal
              </button>
              {profileEditAllowed ? (
                <button type="button" onClick={() => setEditingProfile((current) => !current)} className="rounded-full bg-[#0F5BD8] px-4 py-2 text-sm font-bold text-white">
                  {editingProfile ? "Lock Profile" : "Edit Profile"}
                </button>
              ) : null}
            </div>
          </div>

          {!profileEditAllowed ? (
            <div className="mt-5 rounded-[24px] border border-amber-100 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
              Profile editing is disabled for students. Faculty, admin, and super admin can enable it from Main Settings.
            </div>
          ) : null}

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {PROFILE_FIELDS.map((field) =>
              editingProfile ? (
                <FieldInput
                  key={field.key}
                  label={field.label}
                  value={workspace.profile.basics[field.key] || ""}
                  onChange={(value) => updateProfileBasics(field.key, value)}
                />
              ) : (
                readOnlyLine(field.label, workspace.profile.basics[field.key])
              ),
            )}
          </div>
        </section>
      ) : null}

      {currentView === "ats" ? (
        <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
          <section className="erp-card rounded-[30px] p-6">
            <div className="border-b border-blue-100 pb-4">
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-blue-600">ATS Checker</p>
              <h2 className="mt-2 text-2xl font-extrabold text-slate-900">Match a resume against a job description</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                Select one of the saved resumes, paste the job description, and get an ATS-style score with keyword gaps
                and improvement suggestions.
              </p>
            </div>

            <div className="mt-5 space-y-5">
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Choose Resume</span>
                <select
                  value={atsSelectedResumeId}
                  onChange={(event) => setAtsSelectedResumeId(event.target.value)}
                  className={inputClassName}
                >
                  <option value="">Select a saved resume</option>
                  {workspace.resumes.map((resume) => (
                    <option key={resume.id} value={resume.id}>
                      {resume.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Job Description</span>
                <textarea
                  rows={14}
                  value={atsJobDescription}
                  onChange={(event) => setAtsJobDescription(event.target.value)}
                  placeholder="Paste the full job description here..."
                  className={`${inputClassName} min-h-[280px] resize-y`}
                />
              </label>

              <button
                type="button"
                onClick={runAtsCheck}
                disabled={!atsSelectedResume || !atsJobDescription.trim()}
                className="w-full rounded-[20px] bg-[#0F5BD8] px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                Analyze ATS Match
              </button>

              <div className="rounded-[24px] border border-blue-100 bg-blue-50/70 p-4 text-sm leading-7 text-slate-600">
                This release gives you a strong ATS analyzer with score, keyword matching, and concrete guidance inside
                the product. A true external AI-model review can be plugged in later once an AI provider is configured
                for this app.
              </div>
            </div>
          </section>

          <section className="space-y-6">
            {!atsResult ? (
              <div className="erp-card rounded-[30px] p-8 text-center">
                <p className="text-xs font-bold uppercase tracking-[0.3em] text-blue-600">ATS Report</p>
                <h3 className="mt-3 text-2xl font-extrabold text-slate-900">Run a check to see the score</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  The report will show overall ATS score, keyword match rate, missing keywords, and the best changes to
                  improve the selected resume.
                </p>
              </div>
            ) : (
              <>
                <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {[
                    { label: "Overall Score", value: atsResult.overallScore },
                    { label: "Contact Score", value: atsResult.contactScore },
                    { label: "Section Score", value: atsResult.sectionScore },
                    { label: "Keyword Score", value: atsResult.keywordScore },
                  ].map((card) => (
                    <div key={card.label} className="erp-card rounded-[26px] p-5">
                      <p className="text-xs font-bold uppercase tracking-[0.24em] text-blue-600">{card.label}</p>
                      <p className="mt-4 text-4xl font-extrabold text-slate-900">{card.value}</p>
                    </div>
                  ))}
                </section>

                <section className="erp-card rounded-[30px] p-6">
                  <p className="text-xs font-bold uppercase tracking-[0.3em] text-blue-600">Improvement Suggestions</p>
                  <div className="mt-4 space-y-3">
                    {atsResult.suggestions.length ? (
                      atsResult.suggestions.map((suggestion, index) => (
                        <div key={`${suggestion}-${index}`} className="rounded-[22px] border border-blue-100 bg-blue-50/60 p-4 text-sm leading-7 text-slate-700">
                          {suggestion}
                        </div>
                      ))
                    ) : (
                      <div className="rounded-[22px] border border-emerald-100 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
                        This resume already covers the main ATS basics well for the given job description.
                      </div>
                    )}
                  </div>
                </section>

                <section className="grid gap-6 xl:grid-cols-2">
                  <div className="erp-card rounded-[30px] p-6">
                    <p className="text-xs font-bold uppercase tracking-[0.3em] text-blue-600">Matched Keywords</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {atsResult.matchedKeywords.length ? (
                        atsResult.matchedKeywords.map((keyword) => (
                          <span key={keyword} className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
                            {keyword}
                          </span>
                        ))
                      ) : (
                        <p className="text-sm text-slate-500">No major keywords matched yet.</p>
                      )}
                    </div>
                  </div>

                  <div className="erp-card rounded-[30px] p-6">
                    <p className="text-xs font-bold uppercase tracking-[0.3em] text-blue-600">Missing Keywords</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {atsResult.missingKeywords.length ? (
                        atsResult.missingKeywords.map((keyword) => (
                          <span key={keyword} className="rounded-full border border-amber-100 bg-amber-50 px-3 py-2 text-xs font-bold uppercase tracking-[0.18em] text-amber-700">
                            {keyword}
                          </span>
                        ))
                      ) : (
                        <p className="text-sm text-slate-500">No major keyword gaps detected.</p>
                      )}
                    </div>
                  </div>
                </section>
              </>
            )}
          </section>
        </div>
      ) : null}

      {currentView === "builder" && draftResume ? (
        <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
          <aside className="erp-card rounded-[30px] p-5">
            <div className="border-b border-blue-100 pb-4">
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-blue-600">Section Library</p>
              <h2 className="mt-2 text-2xl font-extrabold text-slate-900">{draftResume.name}</h2>
            </div>
            <div className="mt-5 space-y-6">
              {FIELD_GROUPS.map((group) => (
                <div key={group.id}>
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">{group.title}</p>
                  <div className="mt-3 space-y-2">
                    {group.sectionIds.map((sectionId) => {
                      const active = draftResume.sectionOrder.includes(sectionId);
                      return (
                        <div key={sectionId} className="flex items-center justify-between rounded-[20px] border border-blue-100 bg-white px-4 py-3">
                          <span className="text-sm font-semibold text-slate-700">{SECTION_META[sectionId].label}</span>
                          <button type="button" onClick={() => addSectionToDraft(sectionId)} disabled={active} className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 disabled:bg-slate-100 disabled:text-slate-400">
                            {active ? "Added" : "+"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </aside>

          <section className={`${activeTemplate.palette.page} rounded-[32px] border ${activeTemplate.palette.border} p-4 shadow-[0_24px_60px_rgba(15,91,216,0.10)] md:p-6`}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-blue-100 pb-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.3em] text-blue-600">Live Resume</p>
                <h2 className="mt-2 text-3xl font-extrabold text-slate-900">{draftResume.name}</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                <select value={draftResume.templateId} onChange={(event) => setDraftResume((current) => ({ ...current, templateId: event.target.value }))} className={inputClassName}>
                  {RESUME_TEMPLATES.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
                <button type="button" onClick={() => setCurrentView("portal")} className="rounded-full border border-blue-200 bg-white px-4 py-2 text-sm font-bold text-blue-700">
                  Portal
                </button>
                <button type="button" onClick={() => setAdvancedOpen((current) => !current)} className="rounded-full border border-blue-200 bg-white px-4 py-2 text-sm font-bold text-blue-700">
                  {advancedOpen ? "Hide Advanced" : "Advanced"}
                </button>
                <button type="button" onClick={saveDraftResume} className="rounded-full bg-[#0F5BD8] px-4 py-2 text-sm font-bold text-white">
                  Save Resume
                </button>
                <button type="button" onClick={downloadWord} className="rounded-full border border-blue-200 bg-white px-4 py-2 text-sm font-bold text-blue-700">
                  Word
                </button>
                <button type="button" onClick={() => setDownloadPreviewOpen(true)} className="rounded-full border border-blue-200 bg-white px-4 py-2 text-sm font-bold text-blue-700">
                  Preview PDF
                </button>
              </div>
            </div>

            {advancedOpen ? (
              <div className="mt-5 rounded-[28px] border border-blue-100 bg-white p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.24em] text-blue-600">Advanced Layout</p>
                    <h3 className="mt-2 text-xl font-extrabold text-slate-900">Fine tune ATS-safe styling</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDraftResume((current) => ({ ...current, advancedStyle: createDefaultAdvancedStyle() }))}
                    className="rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700"
                  >
                    Reset
                  </button>
                </div>

                <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                  <AdvancedControl label="Header Space" value={activeAdvancedStyle.headerSpacing} onChange={(value) => updateAdvancedStyle("headerSpacing", value)} min={8} max={36} suffix="px" />
                  <AdvancedControl label="Contact Divider Gap" value={activeAdvancedStyle.contactSpacing} onChange={(value) => updateAdvancedStyle("contactSpacing", value)} min={8} max={28} suffix="px" />
                  <AdvancedControl label="Section Space" value={activeAdvancedStyle.sectionSpacing} onChange={(value) => updateAdvancedStyle("sectionSpacing", value)} min={14} max={40} suffix="px" />
                  <AdvancedControl label="Item Space" value={activeAdvancedStyle.itemSpacing} onChange={(value) => updateAdvancedStyle("itemSpacing", value)} min={8} max={28} suffix="px" />
                  <AdvancedControl label="Page Padding" value={activeAdvancedStyle.pagePadding} onChange={(value) => updateAdvancedStyle("pagePadding", value)} min={28} max={72} suffix="px" />
                  <AdvancedControl label="Divider Thickness" value={activeAdvancedStyle.dividerThickness} onChange={(value) => updateAdvancedStyle("dividerThickness", value)} min={1} max={4} suffix="px" />
                  <AdvancedControl label="Divider Inset" value={activeAdvancedStyle.dividerInset} onChange={(value) => updateAdvancedStyle("dividerInset", value)} min={0} max={36} suffix="px" />
                  <AdvancedControl label="Name Size" value={activeAdvancedStyle.nameSize} onChange={(value) => updateAdvancedStyle("nameSize", value)} min={24} max={42} suffix="px" />
                  <AdvancedControl label="Section Title Size" value={activeAdvancedStyle.sectionTitleSize} onChange={(value) => updateAdvancedStyle("sectionTitleSize", value)} min={12} max={22} suffix="px" />
                  <AdvancedControl label="Body Size" value={activeAdvancedStyle.bodySize} onChange={(value) => updateAdvancedStyle("bodySize", value)} min={12} max={17} suffix="px" />
                  <label className="block">
                    <span className="text-sm font-semibold text-slate-700">Section Case</span>
                    <select
                      value={activeAdvancedStyle.sectionCase}
                      onChange={(event) => updateAdvancedStyle("sectionCase", event.target.value)}
                      className={inputClassName}
                    >
                      <option value="title">Title Case</option>
                      <option value="upper">Uppercase</option>
                      <option value="lower">Lowercase</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-sm font-semibold text-slate-700">Resume Font</span>
                    <select
                      value={activeAdvancedStyle.fontFamily}
                      onChange={(event) => updateAdvancedStyle("fontFamily", event.target.value)}
                      className={inputClassName}
                    >
                      {RESUME_FONT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  {activeTemplate.supportsAccentColor ? (
                    <label className="block">
                      <span className="text-sm font-semibold text-slate-700">Accent Color</span>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {ACCENT_COLOR_OPTIONS.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => updateAdvancedStyle("accentColor", option.value)}
                            className={`flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-bold uppercase tracking-[0.16em] ${
                              activeAdvancedStyle.accentColor === option.value ? "border-slate-900 bg-slate-50 text-slate-900" : "border-slate-200 bg-white text-slate-600"
                            }`}
                          >
                            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: option.value }} />
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </label>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div
              ref={resumeExportRef}
              className={`mx-auto mt-6 ${activeTemplate.page.width} rounded-[28px] border ${activeTemplate.palette.border} ${activeTemplate.palette.sheet}`}
              style={{ padding: `${activeAdvancedStyle.pagePadding}px`, fontFamily: activeAdvancedStyle.fontFamily }}
            >
              {activeTemplate.variant === "accentRibbon" ? (
                <div className="mb-6 h-[10px] rounded-full" style={{ backgroundColor: activeAccentColor }} />
              ) : null}
              <div className={activeTemplate.variant === "cleanEdge" ? "" : "text-center"}>
                <div className="flex items-start justify-between gap-4">
                  <div className={activeTemplate.variant === "cleanEdge" ? "" : "w-full"}>
                    {editingBasics ? (
                      <div className="space-y-4">
                        <input
                          value={draftResume.content.basics.fullName || ""}
                          onChange={(event) => updateDraftBasics("fullName", event.target.value)}
                          placeholder="Your Name"
                          className={`w-full border-0 bg-transparent p-0 ${activeTemplate.palette.heading} outline-none placeholder:text-slate-300 ${activeTemplate.variant === "cleanEdge" ? "text-left" : "text-center"}`}
                          style={{ fontSize: `${activeAdvancedStyle.nameSize}px` }}
                        />
                        <input
                          value={draftResume.content.basics.headline || ""}
                          onChange={(event) => updateDraftBasics("headline", event.target.value)}
                          placeholder="Software Engineer"
                          className={`w-full border-0 bg-transparent p-0 ${activeTemplate.fonts.role} outline-none placeholder:text-slate-300 ${activeTemplate.variant === "cleanEdge" ? "text-left" : "text-center"}`}
                          style={{ color: activeTemplate.variant === "accentRibbon" ? activeAccentColor : undefined }}
                        />
                        <div className={`border-t ${activeTemplate.palette.rule}`} style={{ marginTop: `${activeAdvancedStyle.contactSpacing}px`, borderTopWidth: `${activeAdvancedStyle.dividerThickness}px`, marginLeft: `${activeAdvancedStyle.dividerInset}px`, marginRight: `${activeAdvancedStyle.dividerInset}px` }} />
                        <div className="grid gap-3 md:grid-cols-2">
                          {PROFILE_FIELDS.filter((field) => field.key !== "fullName" && field.key !== "headline").map((field) => (
                            <input
                              key={field.key}
                              value={draftResume.content.basics[field.key] || ""}
                              onChange={(event) => updateDraftBasics(field.key, event.target.value)}
                              placeholder={field.label}
                              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-400"
                            />
                          ))}
                        </div>
                      </div>
                    ) : (
                      <>
                        <h3 className={`${activeTemplate.palette.heading}`} style={{ fontSize: `${activeAdvancedStyle.nameSize}px`, letterSpacing: activeTemplate.variant === "cleanEdge" ? "0.02em" : "0.08em", fontWeight: 600 }}>
                          {draftResume.content.basics.fullName || "YOUR NAME"}
                        </h3>
                        <p className={`${activeTemplate.fonts.role}`} style={{ marginTop: `${Math.max(6, activeAdvancedStyle.headerSpacing / 2)}px`, color: activeTemplate.variant === "accentRibbon" ? activeAccentColor : undefined }}>
                          {draftResume.content.basics.headline || "SOFTWARE ENGINEER"}
                        </p>
                        <div
                          className={`mx-auto border-t ${activeTemplate.palette.rule} ${activeTemplate.variant === "cleanEdge" ? "mx-0" : "max-w-[420px]"}`}
                          style={{
                            marginTop: `${activeAdvancedStyle.contactSpacing}px`,
                            borderTopWidth: `${activeAdvancedStyle.dividerThickness}px`,
                            marginLeft: activeTemplate.variant === "cleanEdge" ? `${activeAdvancedStyle.dividerInset}px` : undefined,
                            marginRight: activeTemplate.variant === "cleanEdge" ? `${activeAdvancedStyle.dividerInset}px` : undefined,
                          }}
                        />
                        <p className={`${activeTemplate.palette.body}`} style={{ marginTop: `${Math.max(10, activeAdvancedStyle.headerSpacing - 2)}px`, fontSize: `${activeAdvancedStyle.bodySize}px`, lineHeight: 1.8 }}>
                          {[draftResume.content.basics.phone, draftResume.content.basics.email, draftResume.content.basics.location, draftResume.content.basics.linkedin, draftResume.content.basics.portfolio, draftResume.content.basics.github]
                            .filter(Boolean)
                            .join(" | ") || "Phone | Email | City, Country | LinkedIn | Portfolio | GitHub"}
                        </p>
                      </>
                    )}
                  </div>
                  <button type="button" onClick={() => setEditingBasics((current) => !current)} className="rounded-full bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700">
                    {editingBasics ? "Save Header" : "Edit Header"}
                  </button>
                </div>
              </div>

              <div className="space-y-6" style={{ marginTop: `${activeAdvancedStyle.sectionSpacing + 8}px` }}>
              {draftResume.sectionOrder.map((sectionId, index) => {
                const meta = SECTION_META[sectionId];
                const value = draftResume.content[sectionId];
                const isEditing = sectionId === "summary" ? editingSummary : sectionEditMap[sectionId];
                const sectionTitleText =
                  activeAdvancedStyle.sectionCase === "upper"
                    ? meta.label.toUpperCase()
                    : activeAdvancedStyle.sectionCase === "lower"
                    ? meta.label.toLowerCase()
                    : meta.label;
                return (
                  <article key={sectionId} className="group">
                    <div
                      className={`border-t ${activeTemplate.palette.rule}`}
                      style={{
                        paddingTop: `${Math.max(12, activeAdvancedStyle.sectionSpacing - 8)}px`,
                        borderTopWidth: `${activeAdvancedStyle.dividerThickness}px`,
                        marginLeft: `${activeAdvancedStyle.dividerInset}px`,
                        marginRight: `${activeAdvancedStyle.dividerInset}px`,
                      }}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-400">Section {index + 1}</p>
                          <h3
                            className={`${activeAdvancedStyle.sectionCase === "upper" || activeTemplate.variant === "cleanEdge" || activeTemplate.variant === "accentRibbon" ? "uppercase tracking-[0.18em]" : ""}`}
                            style={{ marginTop: "8px", fontSize: `${activeAdvancedStyle.sectionTitleSize}px`, fontWeight: activeTemplate.variant === "cleanEdge" ? 700 : 600, color: activeTemplate.variant === "accentRibbon" ? activeAccentColor : undefined }}
                          >
                            {sectionTitleText}
                          </h3>
                        </div>
                        <div className="flex flex-wrap gap-2 opacity-100 md:opacity-0 md:transition group-hover:opacity-100">
                          <button type="button" onClick={() => moveDraftSection(sectionId, "up")} className="rounded-full border border-blue-200 bg-white px-3 py-2 text-xs font-bold text-blue-700">Up</button>
                          <button type="button" onClick={() => moveDraftSection(sectionId, "down")} className="rounded-full border border-blue-200 bg-white px-3 py-2 text-xs font-bold text-blue-700">Down</button>
                          <button type="button" onClick={() => removeSectionFromDraft(sectionId)} className="rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-600">Remove</button>
                          <button
                            type="button"
                            onClick={() => (sectionId === "summary" ? setEditingSummary((current) => !current) : toggleEdit(sectionId, !isEditing))}
                            className="rounded-full bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700"
                          >
                            {isEditing ? "Save" : "Edit"}
                          </button>
                        </div>
                      </div>

                    {meta.kind === "text" ? (
                      <div className="mt-3">
                        {isEditing ? (
                          <InlineTextEditor
                            value={value || ""}
                            onChange={(nextValue) => updateDraftSection(sectionId, nextValue)}
                            placeholder={meta.placeholder}
                          />
                        ) : (
                          <p className={`${activeTemplate.palette.body}`} style={{ fontSize: `${activeAdvancedStyle.bodySize}px`, lineHeight: 1.8 }}>
                            {value || meta.placeholder}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="mt-4 space-y-4">
                        {(value || []).filter((item) => hasContent(item) || isEditing).map((item, itemIndex) => (
                          <div key={`${sectionId}-${itemIndex}`} className="rounded-[18px] border border-transparent bg-transparent p-0" style={{ marginBottom: `${activeAdvancedStyle.itemSpacing}px` }}>
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-[1rem] font-semibold text-slate-900">{buildSectionTitle(sectionId, item) || `${meta.label} ${itemIndex + 1}`}</p>
                                {!isEditing && fieldValueSummary(sectionId, item) ? (
                                  <p className="mt-1 text-sm leading-6 text-slate-500" style={{ fontSize: `${Math.max(12, activeAdvancedStyle.bodySize - 1)}px` }}>{fieldValueSummary(sectionId, item)}</p>
                                ) : null}
                              </div>
                              {isEditing ? (
                                <button type="button" onClick={() => removeEntry(sectionId, itemIndex)} className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-bold text-rose-600">
                                  Delete
                                </button>
                              ) : null}
                            </div>
                            {isEditing ? (
                              <div className="mt-3">
                                <InlineItemEditor
                                  meta={meta}
                                  item={item}
                                  onChange={(fieldKey, nextValue) => updateEntry(sectionId, itemIndex, fieldKey, nextValue)}
                                />
                              </div>
                            ) : (
                              <>
                                {["achievements", "description", "details", "detail", "content", "items"].some((fieldKey) => item[fieldKey]) ? (
                                  <div className="mt-2 space-y-1">
                                    {[item.achievements, item.description, item.details, item.detail, item.content, item.items]
                                      .filter(Boolean)
                                      .map((line, lineIndex) => (
                                        <p key={`${sectionId}-${itemIndex}-${lineIndex}`} className="text-slate-700" style={{ fontSize: `${activeAdvancedStyle.bodySize}px`, lineHeight: 1.8 }}>
                                          {line}
                                        </p>
                                      ))}
                                  </div>
                                ) : null}
                              </>
                            )}
                          </div>
                        ))}
                        {isEditing ? (
                          <button type="button" onClick={() => addEntry(sectionId)} className="rounded-full bg-[#0F5BD8] px-4 py-2 text-sm font-bold text-white">
                            {meta.addLabel}
                          </button>
                        ) : null}
                      </div>
                    )}
                    </div>
                  </article>
                );
              })}
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {downloadPreviewOpen && draftResume ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4">
          <div className="flex h-[92vh] w-full max-w-[1200px] flex-col overflow-hidden rounded-[32px] bg-white shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-blue-100 px-6 py-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-blue-600">Download Preview</p>
                <h3 className="mt-2 text-2xl font-extrabold text-slate-900">{draftResume.name || "Resume Preview"}</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={downloadWord} className="rounded-full border border-blue-200 bg-white px-4 py-2 text-sm font-bold text-blue-700">
                  Download Word
                </button>
                <button type="button" onClick={downloadPdf} className="rounded-full bg-[#0F5BD8] px-4 py-2 text-sm font-bold text-white">
                  Download PDF
                </button>
                <button type="button" onClick={() => setDownloadPreviewOpen(false)} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700">
                  Close
                </button>
              </div>
            </div>
              <div className="flex-1 overflow-auto bg-slate-100 p-6">
              <div
                ref={previewExportRef}
                className="mx-auto max-w-[900px] rounded-[24px] bg-white shadow-[0_18px_50px_rgba(15,23,42,0.14)]"
                style={{ fontFamily: activeAdvancedStyle.fontFamily }}
                dangerouslySetInnerHTML={{ __html: exportMarkup() }}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default ResumeBuilder;
