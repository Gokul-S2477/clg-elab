const buildStorageKey = (userId = "guest") => `resume-builder:${userId}`;

const emptyBasics = () => ({
  fullName: "",
  headline: "",
  email: "",
  phone: "",
  location: "",
  linkedin: "",
  github: "",
  portfolio: "",
});

const blankEducation = () => ({
  school: "",
  degree: "",
  location: "",
  startDate: "",
  endDate: "",
  details: "",
});

const blankExperience = () => ({
  company: "",
  role: "",
  location: "",
  startDate: "",
  endDate: "",
  achievements: "",
});

const blankInternship = () => ({
  company: "",
  role: "",
  location: "",
  startDate: "",
  endDate: "",
  achievements: "",
});

const blankProject = () => ({
  name: "",
  link: "",
  tech: "",
  description: "",
});

const blankSkillGroup = () => ({
  category: "",
  items: "",
});

const blankCertification = () => ({
  name: "",
  issuer: "",
  year: "",
});

const blankAchievement = () => ({
  title: "",
  detail: "",
});

const blankLanguage = () => ({
  name: "",
  proficiency: "",
});

const blankPublication = () => ({
  title: "",
  publisher: "",
  year: "",
  detail: "",
});

const blankVolunteer = () => ({
  organization: "",
  role: "",
  duration: "",
  detail: "",
});

const blankInterest = () => ({
  title: "",
  detail: "",
});

const blankReference = () => ({
  name: "",
  designation: "",
  contact: "",
});

const blankCustomSection = () => ({
  title: "",
  content: "",
});

const defaultAdvancedStyle = () => ({
  headerSpacing: 16,
  sectionSpacing: 24,
  dividerThickness: 1,
  pagePadding: 44,
  nameSize: 32,
  bodySize: 14,
  sectionTitleSize: 16,
  contactSpacing: 12,
  itemSpacing: 14,
  dividerInset: 0,
  sectionCase: "title",
  accentColor: "#0F5BD8",
  fontFamily: "Arial, sans-serif",
});

export const SECTION_LIBRARY = [
  { id: "summary", label: "Professional Summary" },
  { id: "education", label: "Education" },
  { id: "experience", label: "Experience" },
  { id: "internships", label: "Internships" },
  { id: "projects", label: "Projects" },
  { id: "skills", label: "Skills" },
  { id: "certifications", label: "Certifications" },
  { id: "achievements", label: "Achievements" },
  { id: "languages", label: "Languages" },
  { id: "publications", label: "Publications" },
  { id: "volunteerExperience", label: "Volunteer Experience" },
  { id: "hobbies", label: "Hobbies / Interests" },
  { id: "references", label: "References" },
  { id: "customSections", label: "Custom Sections" },
];

export const createDefaultProfile = () => ({
  basics: emptyBasics(),
  summary: "",
  education: [blankEducation()],
  experience: [blankExperience()],
  internships: [blankInternship()],
  projects: [blankProject()],
  skills: [blankSkillGroup()],
  certifications: [blankCertification()],
  achievements: [blankAchievement()],
  languages: [blankLanguage()],
  publications: [blankPublication()],
  volunteerExperience: [blankVolunteer()],
  hobbies: [blankInterest()],
  references: [blankReference()],
  customSections: [blankCustomSection()],
});

const structuredCloneFallback = (value) => JSON.parse(JSON.stringify(value));

export const cloneResumeData = (value) =>
  typeof structuredClone === "function" ? structuredClone(value) : structuredCloneFallback(value);

export const createResumeFromProfile = (profile, count = 0) => {
  const now = new Date().toISOString();
  return {
    id: `resume-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: `Resume ${count + 1}`,
    templateId: "helsinki-ats",
    createdAt: now,
    updatedAt: now,
    sectionOrder: ["summary", "education", "skills", "projects"],
    advancedStyle: defaultAdvancedStyle(),
    content: cloneResumeData(profile),
  };
};

export const createEmptyResumeFromProfile = (profile, count = 0) => {
  const now = new Date().toISOString();
  return {
    id: `resume-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: `Resume ${count + 1}`,
    templateId: "helsinki-ats",
    createdAt: now,
    updatedAt: now,
    sectionOrder: ["summary"],
    advancedStyle: defaultAdvancedStyle(),
    content: {
      ...cloneResumeData(profile),
      summary: "",
      education: [blankEducation()],
      experience: [blankExperience()],
      internships: [blankInternship()],
      projects: [blankProject()],
      skills: [blankSkillGroup()],
      certifications: [blankCertification()],
      achievements: [blankAchievement()],
      languages: [blankLanguage()],
      publications: [blankPublication()],
      volunteerExperience: [blankVolunteer()],
      hobbies: [blankInterest()],
      references: [blankReference()],
      customSections: [blankCustomSection()],
    },
  };
};

export const createDefaultResumeWorkspace = () => {
  const profile = createDefaultProfile();
  return {
    profile,
    resumes: [],
    activeResumeId: null,
  };
};

export const readResumeWorkspace = (userId = "guest") => {
  if (typeof window === "undefined") return createDefaultResumeWorkspace();
  try {
    const stored = window.localStorage.getItem(buildStorageKey(userId));
    if (!stored) return createDefaultResumeWorkspace();
    const parsed = JSON.parse(stored);
    return {
      ...createDefaultResumeWorkspace(),
      ...parsed,
      profile: { ...createDefaultProfile(), ...(parsed.profile || {}) },
      resumes: Array.isArray(parsed.resumes)
        ? parsed.resumes.map((resume) => ({
            ...resume,
            advancedStyle: { ...defaultAdvancedStyle(), ...(resume.advancedStyle || {}) },
          }))
        : createDefaultResumeWorkspace().resumes,
      activeResumeId: parsed.activeResumeId || parsed.resumes?.[0]?.id || createDefaultResumeWorkspace().activeResumeId,
    };
  } catch (error) {
    console.error("Failed to parse resume workspace", error);
    return createDefaultResumeWorkspace();
  }
};

export const saveResumeWorkspace = (userId = "guest", workspace) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(buildStorageKey(userId), JSON.stringify(workspace));
};

export const MAX_RESUMES_PER_USER = 3;

export const newResumeEntryFactories = {
  education: blankEducation,
  experience: blankExperience,
  internships: blankInternship,
  projects: blankProject,
  skills: blankSkillGroup,
  certifications: blankCertification,
  achievements: blankAchievement,
  languages: blankLanguage,
  publications: blankPublication,
  volunteerExperience: blankVolunteer,
  hobbies: blankInterest,
  references: blankReference,
  customSections: blankCustomSection,
};

export const createDefaultAdvancedStyle = defaultAdvancedStyle;
