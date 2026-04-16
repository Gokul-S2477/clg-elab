import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import FeaturedTrackGlyph from "../components/FeaturedTrackGlyph";
import { PRACTICE_SEARCH_QUESTIONS } from "../data/practiceSearchQuestions";
import { API_BASE } from "../utils/api";
import { shouldShowCreateQuestion } from "../utils/roleHelper";
import {
  FEATURED_TRACKS_EVENT,
  getFeaturedTrackGlyph,
  getFeaturedTrackMetricLabel,
  getFeaturedTracks,
} from "../utils/featuredTracks";

const fallbackQuestions = PRACTICE_SEARCH_QUESTIONS;

const fallbackSqlQuestions = fallbackQuestions.filter((question) => question.category === "sql");

const mergeSqlQuestions = (questions = []) => {
  const normalized = new Map();
  questions.forEach((question) => {
    const key = `${String(question.category || "").toLowerCase()}::${String(question.title || "").toLowerCase()}`;
    normalized.set(key, question);
  });

  const sqlCount = questions.filter((question) => question.category === "sql").length;
  if (sqlCount >= fallbackSqlQuestions.length) {
    return questions;
  }

  fallbackSqlQuestions.forEach((question) => {
    const key = `${String(question.category || "").toLowerCase()}::${String(question.title || "").toLowerCase()}`;
    if (!normalized.has(key)) {
      normalized.set(key, question);
    }
  });

  return [...normalized.values()];
};

const librarySections = [
  { label: "Library", badge: null },
  { label: "Quest", badge: "New" },
  { label: "Study Plan", badge: null },
];

const difficultyStyles = {
  easy: "text-emerald-600",
  medium: "text-teal-700",
  hard: "text-rose-600",
};

const parseQuestionMeta = (question) => {
  const tags = question.tags || [];
  const companies = tags
    .filter((tag) => tag.startsWith("company:"))
    .map((tag) => tag.replace("company:", ""));
  const topics = tags.filter((tag) => !tag.startsWith("company:"));
  return { companies, topics };
};

const getSolvedDays = () => {
  try {
    return JSON.parse(localStorage.getItem("practice-solved-days") || "[]");
  } catch {
    return [];
  }
};

const getQuestionStatus = (questionId) => {
  const solved = localStorage.getItem(`practice-solved-${questionId}`) === "true";
  const attemptedFlag = localStorage.getItem(`practice-attempted-${questionId}`) === "true";
  let progress = { attempts: 0, runs: 0 };
  try {
    progress = JSON.parse(localStorage.getItem(`practice-progress-${questionId}`) || "{}");
  } catch {
    progress = { attempts: 0, runs: 0 };
  }
  const attempts = Number(progress.attempts || 0);
  const runs = Number(progress.runs || 0);
  return {
    solved,
    attempted: attemptedFlag || solved || attempts > 0 || runs > 0,
    attempts,
    runs,
  };
};

const getSavedViews = () => {
  const defaults = { favorite: [], confused: [], review: [] };
  try {
    const raw = JSON.parse(localStorage.getItem("practice-saved-views") || "{}");
    return {
      favorite: Array.isArray(raw.favorite) ? raw.favorite.map(String) : defaults.favorite,
      confused: Array.isArray(raw.confused) ? raw.confused.map(String) : defaults.confused,
      review: Array.isArray(raw.review) ? raw.review.map(String) : defaults.review,
    };
  } catch {
    return defaults;
  }
};

const setSavedViews = (next) => {
  localStorage.setItem("practice-saved-views", JSON.stringify(next));
  return next;
};

const formatTopicLabel = (value) =>
  value === "sql"
    ? "SQL"
    :
  value
    .split("-")
    .join(" ")
    .replace(/\b\w/g, (match) => match.toUpperCase());

const getStreakSummary = (solvedDays) => {
  const uniqueDays = [...new Set(solvedDays)].sort();
  if (uniqueDays.length === 0) {
    return { current: 0, total: 0 };
  }

  let streak = 1;
  for (let index = uniqueDays.length - 1; index > 0; index -= 1) {
    const current = new Date(uniqueDays[index]);
    const previous = new Date(uniqueDays[index - 1]);
    const diff = Math.round((current - previous) / (1000 * 60 * 60 * 24));
    if (diff === 1) streak += 1;
    else break;
  }

  return { current: streak, total: uniqueDays.length };
};

const buildCalendar = (solvedDays) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const solvedSet = new Set(solvedDays);
  const cells = [];

  for (let index = 0; index < firstDay; index += 1) {
    cells.push({ type: "empty", key: `empty-${index}` });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const iso = new Date(year, month, day).toISOString().slice(0, 10);
    cells.push({
      type: "day",
      key: iso,
      day,
      solved: solvedSet.has(iso),
      today: day === now.getDate(),
    });
  }

  return {
    monthLabel: now.toLocaleString("default", { month: "long", year: "numeric" }),
    cells,
  };
};

const QuestionList = () => {
  const navigate = useNavigate();
  const { topicSlug } = useParams();
  const showCreate = shouldShowCreateQuestion();
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedTopic, setSelectedTopic] = useState(topicSlug || "");
  const [difficultyFilter, setDifficultyFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [sortMode, setSortMode] = useState("recommended");
  const [savedViewFilter, setSavedViewFilter] = useState("all");
  const [filtersExpanded, setFiltersExpanded] = useState(true);
  const [savedViews, setSavedViewsState] = useState(() => getSavedViews());
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [featuredTracks, setFeaturedTracks] = useState(() => getFeaturedTracks());
  const mainScrollRef = useRef(null);

  useEffect(() => {
    setSelectedTopic(topicSlug || "");
  }, [topicSlug]);

  useEffect(() => {
    const controller = new AbortController();

    const fetchQuestions = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`${API_BASE}/questions?limit=80`, { signal: controller.signal });
        if (!response.ok) throw new Error("Unable to load questions right now");
        const payload = await response.json();
        setQuestions(mergeSqlQuestions(payload));
      } catch (requestError) {
        if (requestError.name !== "AbortError") {
          setQuestions(mergeSqlQuestions(fallbackQuestions));
          setError("Backend is unavailable. Showing local sample questions for now.");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchQuestions();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const refreshFeaturedTracks = () => setFeaturedTracks(getFeaturedTracks());
    window.addEventListener(FEATURED_TRACKS_EVENT, refreshFeaturedTracks);
    window.addEventListener("storage", refreshFeaturedTracks);
    return () => {
      window.removeEventListener(FEATURED_TRACKS_EVENT, refreshFeaturedTracks);
      window.removeEventListener("storage", refreshFeaturedTracks);
    };
  }, []);

  const solvedDays = useMemo(() => getSolvedDays(), []);
  const streak = useMemo(() => getStreakSummary(solvedDays), [solvedDays]);
  const calendar = useMemo(() => buildCalendar(solvedDays), [solvedDays]);

  const enrichedQuestions = useMemo(
    () =>
      questions.map((question, index) => {
        const meta = parseQuestionMeta(question);
        const status = getQuestionStatus(question.id);
        return {
          ...question,
          order: index + 1,
          acceptance: `${Math.max(34, 78 - index * 2.4).toFixed(1)}%`,
          ...meta,
          ...status,
        };
      }),
    [questions],
  );

  const topicMap = useMemo(() => {
    const counts = new Map();
    enrichedQuestions.forEach((question) => {
      question.topics.forEach((topic) => {
        counts.set(topic, (counts.get(topic) || 0) + 1);
      });
    });
    const entries = [...counts.entries()].sort((left, right) => right[1] - left[1]);
    const sqlIndex = entries.findIndex(([topic]) => topic === "sql");
    if (sqlIndex > 0) {
      const [sqlEntry] = entries.splice(sqlIndex, 1);
      entries.unshift(sqlEntry);
    }
    return entries;
  }, [enrichedQuestions]);

  const companyMap = useMemo(() => {
    const counts = new Map();
    enrichedQuestions.forEach((question) => {
      question.companies.forEach((company) => {
        counts.set(company, (counts.get(company) || 0) + 1);
      });
    });
    return [...counts.entries()].sort((left, right) => right[1] - left[1]).slice(0, 10);
  }, [enrichedQuestions]);

  const filteredQuestions = useMemo(() => {
    const searchTerm = search.trim().toLowerCase();
    const list = enrichedQuestions.filter((question) => {
      const searchMatch =
        !searchTerm ||
        question.title.toLowerCase().includes(searchTerm) ||
        question.topics.some((topic) => topic.toLowerCase().includes(searchTerm)) ||
        question.companies.some((company) => company.toLowerCase().includes(searchTerm));
      const topicMatch = !selectedTopic || question.topics.includes(selectedTopic);
      const difficultyMatch = difficultyFilter === "all" || question.difficulty === difficultyFilter;
      const statusMatch =
        statusFilter === "all" ||
        (statusFilter === "solved" && question.solved) ||
        (statusFilter === "unsolved" && !question.solved) ||
        (statusFilter === "attempted" && question.attempted && !question.solved);
      const companyMatch = companyFilter === "all" || question.companies.includes(companyFilter);
      const savedMatch =
        savedViewFilter === "all" ||
        (savedViewFilter === "favorite" && savedViews.favorite.includes(String(question.id))) ||
        (savedViewFilter === "confused" && savedViews.confused.includes(String(question.id))) ||
        (savedViewFilter === "review" && savedViews.review.includes(String(question.id)));
      return searchMatch && topicMatch && difficultyMatch && statusMatch && companyMatch && savedMatch;
    });

    const rankDifficulty = { easy: 0, medium: 1, hard: 2 };
    const sorters = {
      recommended: (left, right) => Number(right.solved) - Number(left.solved) || Number(right.attempted) - Number(left.attempted) || left.order - right.order,
      acceptance: (left, right) => parseFloat(right.acceptance) - parseFloat(left.acceptance),
      newest: (left, right) => right.order - left.order,
      difficulty: (left, right) => rankDifficulty[left.difficulty] - rankDifficulty[right.difficulty] || left.order - right.order,
      title: (left, right) => left.title.localeCompare(right.title),
    };

    return list.sort(sorters[sortMode] || sorters.recommended);
  }, [enrichedQuestions, search, selectedTopic, difficultyFilter, statusFilter, companyFilter, sortMode, savedViewFilter, savedViews]);

  const topicSummary = useMemo(() => {
    if (!selectedTopic) return null;
    const topicQuestions = enrichedQuestions.filter((question) => question.topics.includes(selectedTopic));
    const easy = topicQuestions.filter((question) => question.difficulty === "easy").length;
    const medium = topicQuestions.filter((question) => question.difficulty === "medium").length;
    const hard = topicQuestions.filter((question) => question.difficulty === "hard").length;
    const solved = topicQuestions.filter((question) => question.solved).length;
    const attempted = topicQuestions.filter((question) => question.attempted && !question.solved).length;
    return {
      total: topicQuestions.length,
      easy,
      medium,
      hard,
      solved,
      attempted,
    };
  }, [enrichedQuestions, selectedTopic]);

  const overallSummary = useMemo(() => {
    const solved = enrichedQuestions.filter((question) => question.solved).length;
    const attempted = enrichedQuestions.filter((question) => question.attempted && !question.solved).length;
    return { solved, attempted, total: enrichedQuestions.length };
  }, [enrichedQuestions]);

  const featuredStats = useMemo(() => {
    const difficultyCounts = enrichedQuestions.reduce(
      (accumulator, question) => {
        accumulator[question.difficulty] = (accumulator[question.difficulty] || 0) + 1;
        return accumulator;
      },
      { easy: 0, medium: 0, hard: 0 },
    );
    const statusCounts = {
      solved: overallSummary.solved,
      attempted: overallSummary.attempted,
      unsolved: overallSummary.total - overallSummary.solved - overallSummary.attempted,
      all: overallSummary.total,
    };
    const topicCounts = Object.fromEntries(topicMap);
    const companyCounts = Object.fromEntries(companyMap);
    const savedViewCounts = {
      favorite: savedViews.favorite.length,
      confused: savedViews.confused.length,
      review: savedViews.review.length,
    };
    return {
      totalQuestions: overallSummary.total,
      overallSolved: overallSummary.solved,
      topicCounts,
      companyCounts,
      difficultyCounts,
      statusCounts,
      savedViewCounts,
    };
  }, [companyMap, enrichedQuestions, overallSummary.solved, overallSummary.attempted, overallSummary.total, savedViews.confused.length, savedViews.favorite.length, savedViews.review.length, topicMap]);

  const activeFilterCount = [
    difficultyFilter !== "all",
    statusFilter !== "all",
    companyFilter !== "all",
    sortMode !== "recommended",
    savedViewFilter !== "all",
    Boolean(search.trim()),
  ].filter(Boolean).length;

  const resetFilters = () => {
    setSearch("");
    setDifficultyFilter("all");
    setStatusFilter("all");
    setCompanyFilter("all");
    setSortMode("recommended");
    setSavedViewFilter("all");
  };

  const scrollMainToTop = () => {
    if (mainScrollRef.current) {
      mainScrollRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const toggleSavedView = (questionId, key) => {
    const id = String(questionId);
    setSavedViewsState((current) => {
      const next = { ...current };
      const list = new Set(next[key] || []);
      if (list.has(id)) list.delete(id);
      else list.add(id);
      next[key] = [...list];
      setSavedViews(next);
      return next;
    });
  };

  const applyPreset = (key) => {
    if (key === "all") {
      resetFilters();
      return;
    }
    if (key === "solved") {
      setStatusFilter("solved");
      setDifficultyFilter("all");
      return;
    }
    if (key === "unsolved") {
      setStatusFilter("unsolved");
      setDifficultyFilter("all");
      return;
    }
    if (key === "favorite" || key === "confused" || key === "review") {
      setSavedViewFilter(key);
    }
  };

  const applyFeaturedTrack = (card) => {
    if (!card) return;

    switch (card.actionType) {
      case "topic":
        setSelectedTopic(card.actionValue || "");
        navigate(`/practice/topic/${card.actionValue}`);
        break;
      case "savedView":
        setSelectedTopic("");
        resetFilters();
        setSavedViewFilter(card.actionValue || "all");
        navigate("/practice");
        break;
      case "company":
        setSelectedTopic("");
        setCompanyFilter(card.actionValue || "all");
        setDifficultyFilter("all");
        setStatusFilter("all");
        setSavedViewFilter("all");
        navigate("/practice");
        break;
      case "difficulty":
        setSelectedTopic("");
        setDifficultyFilter(card.actionValue || "all");
        setStatusFilter("all");
        setCompanyFilter("all");
        setSavedViewFilter("all");
        navigate("/practice");
        break;
      case "status":
        setSelectedTopic("");
        setStatusFilter(card.actionValue || "all");
        setDifficultyFilter("all");
        setCompanyFilter("all");
        setSavedViewFilter("all");
        navigate("/practice");
        break;
      case "progress":
        navigate("/practice/progress");
        break;
      case "reset":
      default:
        setSelectedTopic("");
        resetFilters();
        navigate("/practice");
        break;
    }

    scrollMainToTop();
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[210px,minmax(0,1.7fr),280px] xl:grid-cols-[220px,minmax(0,1.9fr),290px]">
      <aside className="order-2 lg:order-1">
        <div className="space-y-5 lg:sticky lg:top-24">
          <section className="erp-card erp-rise-in overflow-hidden rounded-[28px] p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-blue-600">Library</p>
                <p className="mt-1 text-sm text-slate-500">Main navigation</p>
              </div>
              <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-blue-700">
                Core
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {librarySections.map((item) => (
                <div key={item.label} className="flex items-center justify-between rounded-[18px] border border-[#e3eeff] bg-[#fbfdff] px-4 py-3">
                  <span className="text-sm font-bold text-slate-900">{item.label}</span>
                  {item.badge && (
                    <span className="rounded-full bg-blue-600 px-3 py-1 text-xs font-bold text-white">{item.badge}</span>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className="erp-card erp-rise-in overflow-hidden rounded-[28px] p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-blue-600">My Lists</p>
                <p className="mt-1 text-sm text-slate-500">Saved views and progress</p>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {[
                { key: "all", label: "All Questions", count: enrichedQuestions.length },
                { key: "favorite", label: "Favorite", count: savedViews.favorite.length },
                { key: "confused", label: "Confused", count: savedViews.confused.length },
                { key: "review", label: "Have To Review", count: savedViews.review.length },
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setSavedViewFilter(item.key)}
                  className={`flex w-full items-center justify-between rounded-[18px] border px-4 py-3 text-sm font-semibold transition ${
                    savedViewFilter === item.key
                      ? "border-blue-200 bg-blue-50 text-blue-700 shadow-sm"
                      : "border-[#e3eeff] bg-white text-slate-700 hover:border-blue-200"
                  }`}
                >
                  <span>{item.label}</span>
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-slate-500">{item.count}</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      </aside>

      <main className="min-w-0 order-1 lg:order-2">
        <div ref={mainScrollRef} className="space-y-5">
          <section className="erp-card erp-rise-in overflow-hidden rounded-[28px] p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.4em] text-blue-600">Problems</p>
                <h1 className="mt-2 text-2xl font-extrabold text-slate-900 md:text-3xl">
                  {selectedTopic ? formatTopicLabel(selectedTopic) : "Question Explorer"}
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-500">
                  Browse clean question rows, use the side filters when needed, and keep the list visible without the page feeling crowded.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => navigate("/practice/progress")}
                  className="rounded-full border border-blue-100 bg-white px-4 py-3 text-sm font-semibold text-blue-700"
                >
                  Saved Progress
                </button>
                {showCreate && (
                  <button
                    onClick={() => navigate("/practice-arena-admin")}
                    className="rounded-full bg-gradient-to-r from-blue-600 to-teal-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-100"
                  >
                    Create Question
                  </button>
                )}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <span className="rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
                {overallSummary.total} total
              </span>
              <span className="rounded-full border border-teal-100 bg-teal-50 px-4 py-2 text-sm font-semibold text-teal-700">
                {overallSummary.solved} solved
              </span>
              <span className="rounded-full border border-sky-100 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-700">
                {overallSummary.attempted} attempted
              </span>
              {selectedTopic && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTopic("");
                    navigate("/practice");
                  }}
                  className="rounded-full border border-blue-100 bg-white px-4 py-2 text-sm font-semibold text-blue-700"
                >
                  Clear topic
                </button>
              )}
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {topicMap.slice(0, 7).map(([topic, count]) => (
                <button
                  key={topic}
                  type="button"
                  onClick={() => {
                    setSelectedTopic(topic);
                    navigate(`/practice/topic/${topic}`);
                  }}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    selectedTopic === topic
                      ? "bg-gradient-to-r from-blue-600 to-teal-500 text-white shadow-sm"
                      : "border border-[#d8e6ff] bg-white text-slate-700 hover:border-blue-200"
                  }`}
                >
                  {formatTopicLabel(topic)} <span className="ml-1 opacity-75">{count}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="erp-card erp-rise-in overflow-hidden rounded-[24px] p-5">
            <div className="mb-4 rounded-[20px] border border-[#e6efff] bg-[#f8fbff] p-4">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3 rounded-[16px] border border-[#dce8ff] bg-white px-4 py-3">
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search questions, topics, or companies"
                    className="w-full bg-transparent text-sm text-slate-700 outline-none"
                  />
                </div>
                <select
                  value={difficultyFilter}
                  onChange={(event) => setDifficultyFilter(event.target.value)}
                  className="rounded-[16px] border border-[#dce8ff] bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none"
                >
                  <option value="all">All levels</option>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="rounded-[16px] border border-[#dce8ff] bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none"
                >
                  <option value="all">All status</option>
                  <option value="solved">Solved</option>
                  <option value="unsolved">Unsolved</option>
                  <option value="attempted">Attempted</option>
                </select>
                <select
                  value={sortMode}
                  onChange={(event) => setSortMode(event.target.value)}
                  className="rounded-[16px] border border-[#dce8ff] bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none"
                >
                  <option value="recommended">Recommended</option>
                  <option value="difficulty">Difficulty</option>
                  <option value="acceptance">Acceptance</option>
                  <option value="newest">Newest first</option>
                  <option value="title">Title A-Z</option>
                </select>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setCompanyFilter("all")}
                  className={`rounded-full px-4 py-2 text-sm font-semibold ${
                    companyFilter === "all"
                      ? "bg-gradient-to-r from-blue-600 to-teal-500 text-white"
                      : "border border-[#d8e6ff] bg-white text-slate-700"
                  }`}
                >
                  All Companies
                </button>
                {companyMap.slice(0, 4).map(([company, count]) => (
                  <button
                    key={company}
                    type="button"
                    onClick={() => setCompanyFilter(company)}
                    className={`rounded-full px-4 py-2 text-sm font-semibold ${
                      companyFilter === company
                        ? "bg-gradient-to-r from-blue-600 to-teal-500 text-white"
                        : "border border-[#d8e6ff] bg-white text-slate-700"
                    }`}
                  >
                    {company} <span className="ml-1 opacity-80">{count}</span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={resetFilters}
                  className="rounded-full border border-blue-100 bg-white px-4 py-2 text-sm font-semibold text-blue-700"
                >
                  Reset Filters
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 border-b border-[#e6efff] pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-blue-600">Question Bank</p>
                <p className="mt-1 text-sm text-slate-500">
                  Showing all {filteredQuestions.length} matching questions
                </p>
              </div>
              <button
                type="button"
                onClick={scrollMainToTop}
                className="rounded-full border border-[#d8e6ff] bg-white px-4 py-2 text-sm font-semibold text-slate-700"
              >
                Back to top
              </button>
            </div>

            <div className="mt-4">
              <div className="mb-3 flex items-center justify-between rounded-[16px] border border-[#e6efff] bg-[#fbfdff] px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Question List</p>
                <p className="text-xs font-semibold text-slate-500">{filteredQuestions.length} results</p>
              </div>

              <div className="space-y-3">
                {!loading && error && (
                  <div className="rounded-[16px] border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm font-medium text-amber-700">
                    {error}
                  </div>
                )}
                {loading ? (
                  <div className="rounded-[24px] border border-dashed border-blue-200 px-4 py-12 text-center text-slate-500">
                    Loading published questions...
                  </div>
                ) : filteredQuestions.length === 0 ? (
                  <div className="rounded-[24px] border border-dashed border-blue-200 px-4 py-12 text-center text-slate-500">
                    No questions match the current filters.
                  </div>
                ) : (
                  filteredQuestions.map((question) => (
                    <div
                      key={question.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => navigate(`/practice/${question.id}`)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          navigate(`/practice/${question.id}`);
                        }
                      }}
                      className="flex w-full cursor-pointer flex-col gap-3 rounded-[18px] border border-[#e3eeff] bg-[#fbfdff] px-4 py-4 text-left transition duration-300 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_18px_36px_rgba(37,99,235,0.08)] md:flex-row md:items-center md:justify-between"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-3">
                          <span
                            className={`h-3 w-3 rounded-full ${
                              question.solved ? "bg-emerald-500" : question.attempted ? "bg-blue-500" : "bg-slate-300"
                            }`}
                          />
                          <p className="truncate text-base font-bold text-slate-900 md:text-lg">
                            {question.order}. {question.title}
                          </p>
                        </div>
                        <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">
                          {question.short_description || "Open the question to see details."}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {question.companies.slice(0, 3).map((company) => (
                            <span
                              key={company}
                              className="rounded-full border border-teal-100 bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700"
                            >
                              {company}
                            </span>
                          ))}
                          {question.solved && (
                            <span className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                              Solved
                            </span>
                          )}
                          {!question.solved && question.attempted && (
                            <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                              Attempted
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-col items-start gap-3 md:items-end md:text-right">
                        <div className="flex items-center gap-4">
                          <span className="text-sm font-semibold text-slate-500 md:text-base">{question.acceptance}</span>
                          <span className={`text-sm font-bold md:text-base ${difficultyStyles[question.difficulty] || "text-blue-600"}`}>
                            {question.difficulty === "medium" ? "Med." : formatTopicLabel(question.difficulty)}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {[
                            { key: "favorite", label: "Fav", active: savedViews.favorite.includes(String(question.id)) },
                            { key: "confused", label: "Confused", active: savedViews.confused.includes(String(question.id)) },
                            { key: "review", label: "Review", active: savedViews.review.includes(String(question.id)) },
                          ].map((item) => (
                            <button
                              key={item.key}
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                toggleSavedView(question.id, item.key);
                              }}
                              className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                                item.active
                                  ? "border border-blue-200 bg-blue-50 text-blue-700"
                                  : "border border-[#d8e6ff] bg-white text-slate-600 hover:border-blue-200"
                              }`}
                            >
                              {item.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        </div>
      </main>

      <aside className="order-3">
        <div className="space-y-4 lg:sticky lg:top-24">
          <section className="erp-card erp-rise-in overflow-hidden rounded-[24px] p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-blue-600">Featured Tracks</p>
                <p className="mt-1 text-xs text-slate-500">Quick actions</p>
              </div>
              <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-blue-700">
                Live
              </span>
            </div>

            <div className="mt-3 space-y-2.5">
              {featuredTracks.map((card) => {
                const metricLabel = getFeaturedTrackMetricLabel(card, featuredStats);
                const glyph = getFeaturedTrackGlyph(card);
                return (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => applyFeaturedTrack(card)}
                    className={`group relative w-full overflow-hidden rounded-[16px] bg-gradient-to-br ${card.accent} p-2.5 text-left text-white shadow-lg transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_36px_rgba(37,99,235,0.18)]`}
                  >
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.18),transparent_48%)]" />
                    <div className="relative flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/15 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.22em] text-white/90">
                          <FeaturedTrackGlyph kind={glyph} className="h-3 w-3" />
                          {metricLabel}
                        </div>
                        <p className="mt-2 text-[13px] font-bold leading-5">{card.title}</p>
                        <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-blue-50">{card.subtitle}</p>
                      </div>
                      <span className="rounded-full border border-white/20 bg-white/10 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.2em] text-white/80">
                        Go
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="erp-card erp-rise-in overflow-hidden rounded-[24px] p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">Current Streak</p>
                <p className="mt-1 text-sm text-slate-500">{calendar.monthLabel}</p>
              </div>
              <span className="rounded-full border border-teal-100 bg-teal-50 px-4 py-2 text-sm font-bold text-teal-700">
                {streak.current} days
              </span>
            </div>

            <div className="mt-4 grid grid-cols-7 gap-1.5 text-center text-[11px] font-semibold text-slate-400">
              {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
                <span key={`${day}-${index}`}>{day}</span>
              ))}
            </div>

            <div className="mt-3 grid grid-cols-7 gap-1.5">
              {calendar.cells.map((cell) =>
                cell.type === "empty" ? (
                  <div key={cell.key} className="h-10 rounded-full" />
                ) : (
                  <div
                    key={cell.key}
                    className={`flex h-9 items-center justify-center rounded-full text-[11px] font-semibold ${
                      cell.solved
                        ? "bg-gradient-to-r from-blue-600 to-teal-500 text-white"
                        : cell.today
                        ? "border border-blue-200 bg-blue-50 text-blue-700"
                        : "bg-[#f5f9ff] text-slate-600"
                    }`}
                  >
                    {cell.day}
                  </div>
                ),
              )}
            </div>

            <div className="mt-4 rounded-[20px] border border-[#e3eeff] bg-[#fbfdff] p-3">
              <p className="text-sm font-semibold text-slate-900">Solved History</p>
              <p className="mt-2 text-sm text-slate-500">Total active days: {streak.total}</p>
            </div>
          </section>

          <section className="erp-card overflow-hidden rounded-[24px] p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-900">Trending Companies</p>
              <span className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-600">Asked Here</span>
            </div>

            <div className="mt-4 rounded-[20px] border border-[#e3eeff] bg-[#fbfdff] px-4 py-3 text-sm text-slate-500">
              Companies are sourced from question metadata in the admin builder.
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              {companyMap.length === 0 ? (
                <p className="text-sm text-slate-500">No company metadata added yet.</p>
              ) : (
                companyMap.map(([company, count]) => (
                  <span key={company} className="rounded-full border border-teal-100 bg-teal-50 px-4 py-2 text-sm font-semibold text-teal-700">
                    {company} {count}
                  </span>
                ))
              )}
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
};

export default QuestionList;
