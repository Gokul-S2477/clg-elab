import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../utils/api";

const readJson = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
};

const getSavedViews = () => ({
  favorite: readJson("practice-saved-views", {}).favorite || [],
  confused: readJson("practice-saved-views", {}).confused || [],
  review: readJson("practice-saved-views", {}).review || [],
});

const getQuestionStatus = (questionId) => {
  const solved = localStorage.getItem(`practice-solved-${questionId}`) === "true";
  const attempted = localStorage.getItem(`practice-attempted-${questionId}`) === "true";
  let progress = { attempts: 0, runs: 0 };
  try {
    progress = JSON.parse(localStorage.getItem(`practice-progress-${questionId}`) || "{}");
  } catch {
    progress = { attempts: 0, runs: 0 };
  }
  return {
    solved,
    attempted: attempted || solved || Number(progress.attempts || 0) > 0 || Number(progress.runs || 0) > 0,
    attempts: Number(progress.attempts || 0),
    runs: Number(progress.runs || 0),
  };
};

const formatTopicLabel = (value) =>
  String(value || "")
    .split("-")
    .join(" ")
    .replace(/\b\w/g, (match) => match.toUpperCase());

const SavedProgress = () => {
  const navigate = useNavigate();
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeList, setActiveList] = useState("favorite");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [savedViews, setSavedViews] = useState(getSavedViews());

  useEffect(() => {
    const controller = new AbortController();
    const fetchQuestions = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`${API_BASE}/questions?limit=80`, { signal: controller.signal });
        if (!response.ok) throw new Error("Unable to load questions");
        setQuestions(await response.json());
      } catch (requestError) {
        if (requestError.name !== "AbortError") {
          setError(requestError.message || "Unable to load saved progress");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchQuestions();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const refresh = () => setSavedViews(getSavedViews());
    window.addEventListener("storage", refresh);
    return () => window.removeEventListener("storage", refresh);
  }, []);

  const enriched = useMemo(
    () =>
      questions.map((question, index) => ({
        ...question,
        order: index + 1,
        ...getQuestionStatus(question.id),
      })),
    [questions],
  );

  const viewMap = {
    favorite: savedViews.favorite,
    confused: savedViews.confused,
    review: savedViews.review,
    solved: enriched.filter((question) => question.solved).map((question) => String(question.id)),
    attempted: enriched.filter((question) => question.attempted && !question.solved).map((question) => String(question.id)),
  };

  const visibleQuestions = useMemo(() => {
    const ids = new Set(viewMap[activeList] || []);
    return enriched.filter((question) => {
      const inView = ids.has(String(question.id));
      const matchesSearch =
        !search ||
        question.title.toLowerCase().includes(search.toLowerCase()) ||
        (question.short_description || "").toLowerCase().includes(search.toLowerCase());
      return inView && matchesSearch;
    });
  }, [enriched, viewMap, activeList, search]);

  const summary = useMemo(
    () => ({
      favorite: savedViews.favorite.length,
      confused: savedViews.confused.length,
      review: savedViews.review.length,
      solved: viewMap.solved.length,
      attempted: viewMap.attempted.length,
    }),
    [savedViews, viewMap],
  );

  const statColors = {
    favorite: "text-blue-700",
    confused: "text-sky-700",
    review: "text-teal-700",
    solved: "text-emerald-700",
    attempted: "text-indigo-700",
  };

  const quickFilters = [
    { key: "all", label: "All", count: questions.length },
    { key: "favorite", label: "Favorite", count: summary.favorite },
    { key: "confused", label: "Confused", count: summary.confused },
    { key: "review", label: "Review", count: summary.review },
    { key: "solved", label: "Solved", count: summary.solved },
    { key: "attempted", label: "Attempted", count: summary.attempted },
  ];

  return (
    <div className="space-y-6">
      <section className="erp-card erp-grid-bg erp-rise-in overflow-hidden rounded-[32px] p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.45em] text-blue-600">Saved Progress</p>
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white px-4 py-2 shadow-sm">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <span className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Study command center</span>
            </div>
            <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-slate-900 md:text-6xl">
              Your study queue
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-8 text-slate-500 md:text-lg">
              Keep track of questions you want to revisit, questions that felt confusing, and the ones you have already solved.
            </p>
          </div>
          <button
            onClick={() => navigate("/practice")}
            className="rounded-full bg-gradient-to-r from-blue-600 to-teal-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-100"
          >
            Back to Question Bank
          </button>
        </div>

        <div className="mt-8 grid gap-3 md:grid-cols-3 xl:grid-cols-5">
          {[
            { key: "favorite", label: "Favorite", color: "blue" },
            { key: "confused", label: "Confused", color: "sky" },
            { key: "review", label: "Review Later", color: "teal" },
            { key: "solved", label: "Solved", color: "emerald" },
            { key: "attempted", label: "Attempted", color: "indigo" },
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setActiveList(item.key)}
              className={`rounded-[24px] border px-4 py-4 text-left transition hover:-translate-y-0.5 ${
                activeList === item.key
                  ? "border-blue-200 bg-gradient-to-br from-blue-50 to-white shadow-[0_18px_40px_rgba(37,99,235,0.10)]"
                  : "border-[#d8e6ff] bg-white hover:border-blue-200"
              }`}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-500">{item.label}</p>
              <p className={`mt-2 text-3xl font-extrabold ${statColors[item.key] || "text-blue-700"}`}>
                {summary[item.key] || 0}
              </p>
              <p className="mt-2 text-xs text-slate-500">Tap to filter your queue</p>
            </button>
          ))}
        </div>
      </section>

      <section className="erp-card overflow-hidden rounded-[28px] p-5 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-blue-600">
              {formatTopicLabel(activeList)}
            </p>
            <p className="mt-1 text-sm text-slate-500">Saved items update instantly from the question bank.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search saved questions"
              className="rounded-full border border-[#d8e6ff] bg-white px-4 py-3 text-sm outline-none"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {quickFilters.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setActiveList(item.key)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                activeList === item.key
                  ? "bg-gradient-to-r from-blue-600 to-teal-500 text-white"
                  : "border border-[#d8e6ff] bg-white text-slate-700 hover:border-blue-200"
              }`}
            >
              {item.label}
              <span className="ml-2 rounded-full bg-white/20 px-2 py-0.5 text-xs font-bold">
                {item.count}
              </span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="mt-6 rounded-[24px] border border-dashed border-blue-200 px-4 py-12 text-center text-slate-500">
            Loading saved progress...
          </div>
        ) : error ? (
          <div className="mt-6 rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-4 text-amber-700">{error}</div>
        ) : visibleQuestions.length === 0 ? (
          <div className="mt-6 rounded-[24px] border border-dashed border-blue-200 px-4 py-12 text-center text-slate-500">
            No questions in this saved list yet.
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            {visibleQuestions.map((question) => (
              <button
                key={question.id}
                onClick={() => navigate(`/practice/${question.id}`)}
                className="flex w-full items-center justify-between gap-4 rounded-[18px] border border-[#e3eeff] bg-[#fbfdff] px-4 py-4 text-left transition hover:-translate-y-0.5 hover:shadow-[0_18px_36px_rgba(37,99,235,0.08)]"
              >
                <div className="min-w-0">
                  <p className="truncate text-base font-bold text-slate-900 md:text-lg">
                    {question.order}. {question.title}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">{question.short_description || "Open to continue practicing."}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(question.tags || []).slice(0, 4).map((tag) => (
                      <span key={tag} className="rounded-full border border-[#d8e6ff] bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="ml-5 flex shrink-0 items-center gap-3 text-right">
                  <span className="rounded-full border border-teal-100 bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700">
                    {question.solved ? "Solved" : question.attempted ? "Attempted" : "Saved"}
                  </span>
                  <span className="rounded-full border border-[#d8e6ff] bg-white px-3 py-1 text-xs font-semibold text-slate-500">
                    {question.acceptance || "N/A"}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default SavedProgress;
