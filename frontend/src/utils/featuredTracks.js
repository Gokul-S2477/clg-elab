const FEATURED_TRACKS_KEY = "practice-featured-tracks";

export const FEATURED_TRACKS_EVENT = "practice-featured-tracks-updated";

export const defaultFeaturedTracks = [
  {
    id: "core",
    title: "Core Interview Track",
    subtitle: "Start with the most asked coding flows",
    cta: "Get Started",
    accent: "from-blue-600 via-blue-500 to-cyan-400",
    actionType: "reset",
    actionValue: "recommended",
  },
  {
    id: "daily",
    title: "Daily Problem Sprint",
    subtitle: "Small wins every day build long-term speed",
    cta: "Keep Practicing",
    accent: "from-sky-500 via-blue-500 to-teal-500",
    actionType: "savedView",
    actionValue: "review",
  },
  {
    id: "topics",
    title: "Topic Deep Dives",
    subtitle: "Arrays, strings, DP and company patterns",
    cta: "Browse Topics",
    accent: "from-cyan-500 via-teal-500 to-blue-600",
    actionType: "topic",
    actionValue: "string",
  },
];

const normalizeTrack = (track, fallback) => ({
  ...fallback,
  ...track,
  id: track?.id || fallback.id,
  title: track?.title || fallback.title,
  subtitle: track?.subtitle || fallback.subtitle,
  cta: track?.cta || fallback.cta,
  accent: track?.accent || fallback.accent,
  actionType: track?.actionType || fallback.actionType,
  actionValue: track?.actionValue ?? fallback.actionValue,
});

export const getFeaturedTracks = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(FEATURED_TRACKS_KEY) || "[]");
    if (!Array.isArray(raw)) return defaultFeaturedTracks;
    return defaultFeaturedTracks.map((fallback, index) => normalizeTrack(raw[index], fallback));
  } catch {
    return defaultFeaturedTracks;
  }
};

export const saveFeaturedTracks = (tracks) => {
  const normalized = defaultFeaturedTracks.map((fallback, index) => normalizeTrack(tracks?.[index], fallback));
  localStorage.setItem(FEATURED_TRACKS_KEY, JSON.stringify(normalized));
  window.dispatchEvent(new Event(FEATURED_TRACKS_EVENT));
  return normalized;
};

export const getFeaturedTrackMetric = (track, stats = {}) => {
  const value = track?.actionValue;
  switch (track?.actionType) {
    case "topic":
      return stats.topicCounts?.[value] ?? 0;
    case "company":
      return stats.companyCounts?.[value] ?? 0;
    case "difficulty":
      return stats.difficultyCounts?.[value] ?? 0;
    case "status":
      return stats.statusCounts?.[value] ?? 0;
    case "savedView":
      return stats.savedViewCounts?.[value] ?? 0;
    case "progress":
      return stats.overallSolved ?? 0;
    default:
      return stats.totalQuestions ?? 0;
  }
};

export const getFeaturedTrackMetricLabel = (track, stats = {}) => {
  const metric = getFeaturedTrackMetric(track, stats);
  switch (track?.actionType) {
    case "topic":
      return `${metric} topics`;
    case "company":
      return `${metric} companies`;
    case "difficulty":
      return `${metric} ${track?.actionValue || "questions"}`;
    case "status":
      return `${metric} ${track?.actionValue || "items"}`;
    case "savedView":
      return `${metric} saved`;
    case "progress":
      return `${metric} solved`;
    default:
      return `${metric} questions`;
  }
};

export const getFeaturedTrackGlyph = (track) => {
  switch (track?.actionType) {
    case "topic":
      return "topic";
    case "company":
      return "company";
    case "savedView":
      return "savedView";
    case "difficulty":
      return "difficulty";
    case "status":
      return "status";
    case "progress":
      return "progress";
    default:
      return "reset";
  }
};
