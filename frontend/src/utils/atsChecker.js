const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "to",
  "with",
  "will",
  "you",
  "your",
  "we",
  "our",
  "this",
  "they",
  "their",
  "role",
  "job",
  "work",
  "candidate",
  "experience",
  "skills",
  "required",
  "preferred",
  "strong",
  "good",
  "ability",
]);

const tokenize = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9+#./-\s]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);

const topKeywords = (jobDescription) => {
  const frequency = new Map();
  tokenize(jobDescription).forEach((token) => {
    if (token.length < 3 || STOP_WORDS.has(token)) return;
    frequency.set(token, (frequency.get(token) || 0) + 1);
  });
  return [...frequency.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 25)
    .map(([token]) => token);
};

export const resumeToPlainText = (resume) => {
  if (!resume) return "";
  const basics = resume.content?.basics || {};
  const sections = resume.sectionOrder || [];
  const lines = [
    basics.fullName,
    basics.headline,
    basics.phone,
    basics.email,
    basics.location,
    basics.linkedin,
    basics.github,
    basics.portfolio,
    resume.content?.summary,
  ];

  sections.forEach((sectionId) => {
    const value = resume.content?.[sectionId];
    if (typeof value === "string") {
      lines.push(value);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item) => {
        Object.values(item || {}).forEach((entry) => lines.push(entry));
      });
    }
  });

  return lines.filter(Boolean).join(" ");
};

export const analyzeResumeAgainstJob = (resume, jobDescription) => {
  const plainResume = resumeToPlainText(resume);
  const resumeTokens = new Set(tokenize(plainResume));
  const keywords = topKeywords(jobDescription);
  const matchedKeywords = keywords.filter((keyword) => resumeTokens.has(keyword));
  const missingKeywords = keywords.filter((keyword) => !resumeTokens.has(keyword));

  const basics = resume?.content?.basics || {};
  const hasSummary = Boolean(String(resume?.content?.summary || "").trim());
  const hasExperience = (resume?.content?.experience || []).some((entry) => Object.values(entry || {}).some(Boolean));
  const hasProjects = (resume?.content?.projects || []).some((entry) => Object.values(entry || {}).some(Boolean));
  const hasSkills = (resume?.content?.skills || []).some((entry) => Object.values(entry || {}).some(Boolean));
  const hasEducation = (resume?.content?.education || []).some((entry) => Object.values(entry || {}).some(Boolean));
  const measurableContent = /\b\d+%|\b\d+x|\b\d+\+|\b\d+\b/.test(plainResume);

  const contactScore =
    [basics.fullName, basics.email, basics.phone, basics.location].filter((item) => String(item || "").trim()).length / 4;
  const sectionScore =
    [hasSummary, hasExperience, hasProjects, hasSkills, hasEducation].filter(Boolean).length / 5;
  const keywordScore = keywords.length ? matchedKeywords.length / keywords.length : 0.5;
  const impactScore = measurableContent ? 1 : 0.35;

  const overallScore = Math.round(
    contactScore * 20 +
      sectionScore * 25 +
      keywordScore * 40 +
      impactScore * 15,
  );

  const suggestions = [];
  if (!hasSummary) suggestions.push("Add a 2-4 line summary so ATS systems and recruiters understand your target role quickly.");
  if (!hasSkills) suggestions.push("Add a dedicated skills section with the core technologies and tools from the job description.");
  if (!hasProjects && !hasExperience) suggestions.push("Include at least one project or experience block so the resume is not too thin for ATS screening.");
  if (!measurableContent) suggestions.push("Add measurable outcomes like percentages, counts, timelines, or impact numbers to improve credibility.");
  if (missingKeywords.length > 0) suggestions.push(`Try naturally adding these missing job keywords where relevant: ${missingKeywords.slice(0, 8).join(", ")}.`);
  if (!basics.linkedin && !basics.github && !basics.portfolio) suggestions.push("Add LinkedIn, GitHub, or portfolio links to strengthen the professional profile.");
  if (String(plainResume).split(/\s+/).length < 180) suggestions.push("The resume looks short for ATS matching. Add more relevant project, skill, or experience detail.");

  return {
    overallScore,
    contactScore: Math.round(contactScore * 100),
    sectionScore: Math.round(sectionScore * 100),
    keywordScore: Math.round(keywordScore * 100),
    impactScore: Math.round(impactScore * 100),
    matchedKeywords,
    missingKeywords,
    suggestions,
  };
};
