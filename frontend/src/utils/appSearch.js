import { SQL_STUDY_COURSE } from "../data/sqlStudyCourse";
import { PRACTICE_SEARCH_QUESTIONS } from "../data/practiceSearchQuestions";
import { isPrivilegedRole } from "./roleHelper";

const ROLES_ALL = ["student", "faculty", "admin", "super_admin"];
const ROLES_PRIVILEGED = ["faculty", "admin", "super_admin"];

const CORE_ENTRIES = [
  { id: "dashboard", label: "Dashboard", hint: "Quick overview and analytics", to: "/dashboard", roles: ROLES_ALL, type: "page", keywords: ["home", "overview", "analytics"] },
  { id: "profile", label: "Profile Center", hint: "Basic details, education, skills, and goals", to: "/profile", roles: ROLES_ALL, type: "page", keywords: ["profile", "personal", "resume data"] },
  { id: "practice", label: "Practice Arena", hint: "Question bank and coding practice", to: "/practice", roles: ROLES_ALL, type: "page", keywords: ["questions", "coding", "sql practice"] },
  { id: "study", label: "Study Modules", hint: "Structured learning modules", to: "/study", roles: ROLES_ALL, type: "page", keywords: ["learning", "study", "modules"] },
  { id: "study-sql", label: "SQL Module", hint: "Full SQL learning module", to: "/study/sql", roles: ROLES_ALL, type: "module", keywords: ["sql", "database", "queries"] },
  { id: "study-python", label: "Python Module", hint: "Standalone Python learning module", to: "/study/python", roles: ROLES_ALL, type: "module", keywords: ["python", "learning", "programming"] },
  { id: "resume", label: "Resume Builder", hint: "Create ATS-friendly resumes", to: "/dashboard/resume-builder", roles: ROLES_ALL, type: "page", keywords: ["resume", "cv", "ats"] },
  { id: "progress", label: "Saved Progress", hint: "Practice history and bookmarks", to: "/practice/progress", roles: ROLES_ALL, type: "page", keywords: ["progress", "saved", "bookmarks"] },
  { id: "playground", label: "Playground", hint: "Compiler, SQL, app, and notebook workspaces", to: "/playground", roles: ROLES_ALL, type: "page", keywords: ["playground", "compiler", "sql lab", "notebook"] },
  { id: "playground-compiler", label: "Compiler Lab", hint: "Open the code compiler directly", to: "/playground?module=compiler", roles: ROLES_ALL, type: "lab", keywords: ["compiler", "code editor", "python", "javascript"] },
  { id: "playground-app", label: "App Playground", hint: "Open the app builder directly", to: "/playground?module=app", roles: ROLES_ALL, type: "lab", keywords: ["streamlit", "app", "builder"] },
  { id: "playground-sql", label: "SQL Playground", hint: "Open the SQL lab directly", to: "/playground?module=sql", roles: ROLES_ALL, type: "lab", keywords: ["sql", "dataset", "queries"] },
  { id: "playground-notebook", label: "Notebook Lab", hint: "Open the notebook workspace directly", to: "/playground?module=notebook", roles: ROLES_ALL, type: "lab", keywords: ["notebook", "cells", "lab"] },
  { id: "content-studio", label: "Content Studio", hint: "Manage modules and featured content", to: "/content-studio", roles: ROLES_PRIVILEGED, type: "page", keywords: ["content", "modules", "announcements"] },
  { id: "settings", label: "Main Settings", hint: "System-wide controls", to: "/settings", roles: ROLES_PRIVILEGED, type: "page", keywords: ["settings", "permissions", "system"] },
];

const sqlTopicEntries = SQL_STUDY_COURSE.topics.map((topic) => ({
  id: `sql-${topic.id}`,
  label: topic.title,
  hint: `SQL topic in ${topic.moduleTitle || "study module"}`,
  to: `/study/sql?topic=${topic.id}`,
  roles: ROLES_ALL,
  type: "topic",
  keywords: ["sql", topic.moduleTitle || "module", ...(topic.subtopics || [])],
}));

const practiceEntries = PRACTICE_SEARCH_QUESTIONS.map((question) => {
  const tags = Array.isArray(question.tags) ? question.tags : [];
  const cleanedTags = tags.map((tag) => String(tag).replace("company:", "company "));
  return {
    id: `question-${question.id}`,
    label: question.title,
    hint: `${question.category?.toUpperCase?.() || "QUESTION"} ? ${question.difficulty || ""} ? ${question.short_description || "Practice question"}`,
    to: `/practice/${question.id}`,
    roles: ROLES_ALL,
    type: question.category === "sql" ? "sql question" : "question",
    keywords: [question.category, question.difficulty, question.short_description, ...cleanedTags].filter(Boolean),
  };
});

const normalize = (value = "") => String(value).toLowerCase().trim();

const scoreEntry = (entry, query) => {
  const q = normalize(query);
  if (!q) return 1;
  const label = normalize(entry.label);
  const hint = normalize(entry.hint);
  const keywords = (entry.keywords || []).map(normalize).join(" ");

  let score = 0;
  if (label === q) score += 200;
  if (label.startsWith(q)) score += 120;
  if (label.includes(q)) score += 90;
  if (hint.includes(q)) score += 45;
  if (keywords.includes(q)) score += 30;

  const queryWords = q.split(/\s+/).filter(Boolean);
  queryWords.forEach((word) => {
    if (label.includes(word)) score += 20;
    if (hint.includes(word)) score += 10;
    if (keywords.includes(word)) score += 8;
  });

  return score;
};

export const getAppSearchEntries = (user) => {
  const role = user?.role || "student";
  return [...CORE_ENTRIES, ...sqlTopicEntries, ...practiceEntries].filter((entry) => entry.roles.includes(role));
};

export const searchAppEntries = (user, query) => {
  const entries = getAppSearchEntries(user);
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return entries.slice(0, 16);

  return entries
    .map((entry) => ({ entry, score: scoreEntry(entry, normalizedQuery) }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || left.entry.label.localeCompare(right.entry.label))
    .slice(0, 20)
    .map((item) => item.entry);
};

export const getQuickActions = (user) => {
  const shared = [
    { label: "Open Profile", to: "/profile" },
    { label: "Continue SQL", to: "/study/sql" },
    { label: "Resume Builder", to: "/dashboard/resume-builder" },
  ];
  if (isPrivilegedRole(user?.role)) {
    return [...shared, { label: "Content Studio", to: "/content-studio" }, { label: "Main Settings", to: "/settings" }];
  }
  return shared;
};
