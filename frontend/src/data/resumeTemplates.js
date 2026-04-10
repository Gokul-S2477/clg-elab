export const RESUME_TEMPLATES = [
  {
    id: "helsinki-ats",
    name: "Helsinki ATS",
    description: "Minimal ATS-friendly resume with clean dividers and centered identity block.",
    preview: "Best for campus placements and software roles where clean parsing matters.",
    variant: "helsinki",
    supportsAccentColor: false,
    page: {
      width: "max-w-[820px]",
      bodyPadding: "px-10 py-10 md:px-14",
    },
    palette: {
      page: "bg-[#f5f5f3]",
      sheet: "bg-white",
      border: "border-slate-200",
      heading: "text-slate-900",
      body: "text-slate-700",
      muted: "text-slate-500",
      rule: "border-slate-300",
    },
    fonts: {
      header: "text-[2.1rem] font-semibold tracking-[0.08em]",
      role: "text-xs font-semibold uppercase tracking-[0.24em]",
      section: "text-[1.05rem] font-semibold tracking-tight",
      body: "text-[0.96rem] leading-7",
    },
  },
  {
    id: "clean-edge-ats",
    name: "Clean Edge ATS",
    description: "Sharper one-column resume with left-aligned identity and crisp section rhythm.",
    preview: "Good for internships, analyst roles, and freshers who want an ATS-safe modern look.",
    variant: "cleanEdge",
    supportsAccentColor: false,
    page: {
      width: "max-w-[820px]",
      bodyPadding: "px-8 py-9 md:px-12",
    },
    palette: {
      page: "bg-[#eef3f8]",
      sheet: "bg-white",
      border: "border-slate-200",
      heading: "text-slate-950",
      body: "text-slate-700",
      muted: "text-slate-500",
      rule: "border-slate-300",
    },
    fonts: {
      header: "text-[2rem] font-bold tracking-tight",
      role: "text-sm font-semibold uppercase tracking-[0.18em]",
      section: "text-[0.96rem] font-bold uppercase tracking-[0.22em]",
      body: "text-[0.95rem] leading-7",
    },
  },
  {
    id: "accent-ribbon-ats",
    name: "Accent Ribbon ATS",
    description: "Premium ATS template with a clean accent ribbon, stronger hierarchy, and more visual separation.",
    preview: "Best when you want a premium-looking ATS resume with customizable accent color.",
    variant: "accentRibbon",
    supportsAccentColor: true,
    page: {
      width: "max-w-[850px]",
      bodyPadding: "px-10 py-10 md:px-16",
    },
    palette: {
      page: "bg-[#eef4ff]",
      sheet: "bg-white",
      border: "border-slate-200",
      heading: "text-slate-950",
      body: "text-slate-700",
      muted: "text-slate-500",
      rule: "border-slate-300",
    },
    fonts: {
      header: "text-[2.15rem] font-bold tracking-[0.03em]",
      role: "text-[0.8rem] font-semibold uppercase tracking-[0.26em]",
      section: "text-[0.98rem] font-bold uppercase tracking-[0.18em]",
      body: "text-[0.95rem] leading-7",
    },
  },
];

export const getResumeTemplateById = (templateId) =>
  RESUME_TEMPLATES.find((template) => template.id === templateId) || RESUME_TEMPLATES[0];
