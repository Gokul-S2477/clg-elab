import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import FeaturedTrackGlyph from "../components/FeaturedTrackGlyph";
import { API_BASE } from "../utils/api";
import { getStoredUser, isPrivilegedRole } from "../utils/roleHelper";
import {
  defaultFeaturedTracks,
  getFeaturedTrackGlyph,
  getFeaturedTrackMetricLabel,
  saveFeaturedTracks,
} from "../utils/featuredTracks";

const createInitialState = () => ({
  title: "",
  difficulty: "medium",
  category: "coding",
  tags: [],
  problem_statement: "",
  short_description: "",
  diagram_url: "",
  diagram_caption: "",
  input_format: "",
  output_format: "",
  sql_schema: "",
  expected_output: "",
  sample_tables: [],
  function_signature: "",
  constraints: "",
  time_limit: 1,
  memory_limit: 256,
  points: 10,
  visibility: "published",
  examples: [],
  test_cases: [],
  starter_codes: {
    python: "def solve(*args, **kwargs):\n    pass",
    javascript: "function solve(...args) {\n  return null;\n}",
    java: "",
    cpp: "",
    sql: "SELECT *\nFROM your_table;",
  },
  solutions: [],
});

const companyPrefix = "company:";
const featuredActionOptions = [
  { value: "reset", label: "Reset Filters" },
  { value: "topic", label: "Topic Page" },
  { value: "company", label: "Company Filter" },
  { value: "savedView", label: "Saved View" },
  { value: "difficulty", label: "Difficulty Filter" },
  { value: "status", label: "Status Filter" },
  { value: "progress", label: "Saved Progress" },
];
const savedViewOptions = [
  { value: "favorite", label: "Favorite" },
  { value: "confused", label: "Confused" },
  { value: "review", label: "Review Later" },
];
const difficultyOptions = [
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
];
const statusOptions = [
  { value: "all", label: "All" },
  { value: "solved", label: "Solved" },
  { value: "unsolved", label: "Unsolved" },
  { value: "attempted", label: "Attempted" },
];

const splitTags = (tags = []) => ({
  topics: tags.filter((tag) => !tag.startsWith(companyPrefix)),
  companies: tags.filter((tag) => tag.startsWith(companyPrefix)).map((tag) => tag.replace(companyPrefix, "")),
});

const PracticeArenaAdmin = () => {
  const navigate = useNavigate();
  const user = getStoredUser();
  const [questionList, setQuestionList] = useState([]);
  const [selectedQuestionId, setSelectedQuestionId] = useState(null);
  const [formData, setFormData] = useState(createInitialState());
  const [tagInput, setTagInput] = useState("");
  const [companyInput, setCompanyInput] = useState("");
  const [exampleInput, setExampleInput] = useState({ input: "", output: "", explanation: "" });
  const [testCaseInput, setTestCaseInput] = useState({ input: "", output: "", is_hidden: false });
  const [sampleTableInput, setSampleTableInput] = useState({ name: "", columns: "", rows: '[["1","Asha","100"]]' });
  const [submitMessage, setSubmitMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [featuredTracks, setFeaturedTracksState] = useState(() => defaultFeaturedTracks);
  const [featuredMessage, setFeaturedMessage] = useState("");

  const isAuthorized = isPrivilegedRole(user?.role);

  const fetchQuestionList = async () => {
    const response = await fetch(`${API_BASE}/questions/manage/all`);
    if (!response.ok) {
      throw new Error("Unable to load question list");
    }
    setQuestionList(await response.json());
  };

  useEffect(() => {
    if (!isAuthorized) return;
    fetchQuestionList().catch((error) => setSubmitMessage(error.message));
  }, [isAuthorized]);

  const topicOptions = useMemo(() => {
    const topics = new Set();
    questionList.forEach((question) => {
      (question.tags || []).forEach((tag) => {
        if (!tag.startsWith(companyPrefix)) {
          topics.add(tag);
        }
      });
    });
    return [...topics].sort();
  }, [questionList]);

  const companyOptions = useMemo(() => {
    const companies = new Set();
    questionList.forEach((question) => {
      (question.tags || []).forEach((tag) => {
        if (tag.startsWith(companyPrefix)) {
          companies.add(tag.replace(companyPrefix, ""));
        }
      });
    });
    return [...companies].sort();
  }, [questionList]);

  const featuredPreviewStats = useMemo(() => {
    const topicCounts = {};
    const companyCounts = {};
    const difficultyCounts = { easy: 0, medium: 0, hard: 0 };
    const statusCounts = { solved: 0, attempted: 0, unsolved: 0, all: questionList.length };

    questionList.forEach((question, index) => {
      const difficulty = question.difficulty || "medium";
      difficultyCounts[difficulty] = (difficultyCounts[difficulty] || 0) + 1;
      if (index % 3 === 0) statusCounts.solved += 1;
      else if (index % 3 === 1) statusCounts.attempted += 1;
      else statusCounts.unsolved += 1;

      (question.tags || []).forEach((tag) => {
        if (tag.startsWith(companyPrefix)) {
          const company = tag.replace(companyPrefix, "");
          companyCounts[company] = (companyCounts[company] || 0) + 1;
        } else {
          topicCounts[tag] = (topicCounts[tag] || 0) + 1;
        }
      });
    });

    return {
      totalQuestions: questionList.length,
      overallSolved: statusCounts.solved,
      topicCounts,
      companyCounts,
      difficultyCounts,
      statusCounts,
      savedViewCounts: {
        favorite: 0,
        confused: 0,
        review: 0,
      },
    };
  }, [questionList]);

  if (!isAuthorized) {
    return (
      <div className="rounded-[32px] border border-red-200 bg-red-50 px-6 py-10 text-center text-red-600">
        Only faculty, admin, and super admin users can access question management.
      </div>
    );
  }

  const updateField = (name, value) => setFormData((current) => ({ ...current, [name]: value }));

  const addTag = () => {
    const nextTag = tagInput.trim();
    if (!nextTag || formData.tags.includes(nextTag)) return;
    setFormData((current) => ({ ...current, tags: [...current.tags, nextTag] }));
    setTagInput("");
  };

  const removeTag = (tagToRemove) => {
    setFormData((current) => ({
      ...current,
      tags: current.tags.filter((tag) => tag !== tagToRemove),
    }));
  };

  const addCompany = () => {
    const nextCompany = companyInput.trim();
    const encoded = `${companyPrefix}${nextCompany}`;
    if (!nextCompany || formData.tags.includes(encoded)) return;
    setFormData((current) => ({ ...current, tags: [...current.tags, encoded] }));
    setCompanyInput("");
  };

  const addExample = () => {
    if (!exampleInput.input || !exampleInput.output) return;
    setFormData((current) => ({ ...current, examples: [...current.examples, exampleInput] }));
    setExampleInput({ input: "", output: "", explanation: "" });
  };

  const removeExample = (indexToRemove) => {
    setFormData((current) => ({
      ...current,
      examples: current.examples.filter((_, index) => index !== indexToRemove),
    }));
  };

  const addTestCase = () => {
    if (!testCaseInput.input || !testCaseInput.output) return;
    setFormData((current) => ({ ...current, test_cases: [...current.test_cases, testCaseInput] }));
    setTestCaseInput({ input: "", output: "", is_hidden: false });
  };

  const removeTestCase = (indexToRemove) => {
    setFormData((current) => ({
      ...current,
      test_cases: current.test_cases.filter((_, index) => index !== indexToRemove),
    }));
  };

  const addSampleTable = () => {
    try {
      const nextName = sampleTableInput.name.trim();
      const columns = sampleTableInput.columns
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      const rows = JSON.parse(sampleTableInput.rows || "[]");
      if (!nextName || columns.length === 0 || !Array.isArray(rows)) return;
      setFormData((current) => ({
        ...current,
        sample_tables: [...(current.sample_tables || []), { name: nextName, columns, rows }],
      }));
      setSampleTableInput({ name: "", columns: "", rows: '[["1","Asha","100"]]' });
    } catch {
      setSubmitMessage("Sample table rows must be valid JSON, for example [[\"1\",\"Asha\",\"100\"]]");
    }
  };

  const removeSampleTable = (indexToRemove) => {
    setFormData((current) => ({
      ...current,
      sample_tables: (current.sample_tables || []).filter((_, index) => index !== indexToRemove),
    }));
  };

  const addSolution = () => {
    setFormData((current) => ({
      ...current,
      solutions: [
        ...current.solutions,
        {
          language: current.category === "sql" ? "sql" : "python",
          code: "",
          explanation: "",
          approach_type: "optimized",
        },
      ],
    }));
  };

  const updateSolution = (indexToUpdate, field, value) => {
    setFormData((current) => ({
      ...current,
      solutions: current.solutions.map((solution, index) =>
        index === indexToUpdate ? { ...solution, [field]: value } : solution,
      ),
    }));
  };

  const removeSolution = (indexToRemove) => {
    setFormData((current) => ({
      ...current,
      solutions: current.solutions.filter((_, index) => index !== indexToRemove),
    }));
  };

  const updateFeaturedTrack = (indexToUpdate, field, value) => {
    setFeaturedTracksState((current) =>
      current.map((track, index) => (index === indexToUpdate ? { ...track, [field]: value } : track)),
    );
  };

  const resetFeaturedTracks = () => {
    setFeaturedTracksState(defaultFeaturedTracks.map((track) => ({ ...track })));
    setFeaturedMessage("Restored default featured tracks.");
  };

  const persistFeaturedTracks = () => {
    saveFeaturedTracks(featuredTracks);
    setFeaturedMessage("Featured tracks saved and synced to the question bank.");
  };

  const resetForm = () => {
    setSelectedQuestionId(null);
    setFormData(createInitialState());
    setTagInput("");
    setCompanyInput("");
    setExampleInput({ input: "", output: "", explanation: "" });
    setTestCaseInput({ input: "", output: "", is_hidden: false });
    setSampleTableInput({ name: "", columns: "", rows: '[["1","Asha","100"]]' });
  };

  const loadQuestion = async (questionId) => {
    const response = await fetch(`${API_BASE}/questions/manage/${questionId}`);
    if (!response.ok) {
      throw new Error("Unable to load question");
    }
    const payload = await response.json();
    const starterCodes = {
      python: "",
      javascript: "",
      java: "",
      cpp: "",
      sql: "",
    };
    (payload.starter_codes || []).forEach((entry) => {
      const key = String(entry.language).toLowerCase();
      if (key.includes("python")) starterCodes.python = entry.code;
      if (key.includes("javascript")) starterCodes.javascript = entry.code;
      if (key.includes("java")) starterCodes.java = entry.code;
      if (key.includes("cpp")) starterCodes.cpp = entry.code;
      if (key.includes("sql")) starterCodes.sql = entry.code;
    });

    setSelectedQuestionId(payload.id);
    const { topics, companies } = splitTags(payload.tags || []);

    setFormData({
      title: payload.title || "",
      difficulty: payload.difficulty || "medium",
      category: payload.category || "coding",
      tags: [...topics, ...companies.map((company) => `${companyPrefix}${company}`)],
      problem_statement: payload.problem_statement || "",
      short_description: payload.short_description || "",
      diagram_url: payload.diagram_url || "",
      diagram_caption: payload.diagram_caption || "",
      input_format: payload.input_format || "",
      output_format: payload.output_format || "",
      sql_schema: payload.sql_schema || "",
      expected_output: payload.expected_output || "",
      sample_tables: payload.sample_tables || [],
      function_signature: payload.function_signature || "",
      constraints: payload.constraints || "",
      time_limit: payload.time_limit || 1,
      memory_limit: payload.memory_limit || 256,
      points: payload.points || 10,
      visibility: payload.visibility || "published",
      examples: payload.examples || [],
      test_cases: payload.test_cases || [],
      starter_codes: starterCodes,
      solutions: payload.solutions || [],
    });
    setCompanyInput("");
    setSubmitMessage(`Loaded "${payload.title}" for editing`);
  };

  const deleteQuestion = async (questionId) => {
    const response = await fetch(`${API_BASE}/questions/${questionId}`, { method: "DELETE" });
    if (!response.ok) {
      throw new Error("Unable to delete question");
    }
    if (selectedQuestionId === questionId) {
      resetForm();
    }
    setSubmitMessage("Question deleted successfully");
    await fetchQuestionList();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setSubmitMessage("");

    try {
      const starterCodes = Object.entries(formData.starter_codes)
        .filter(([, code]) => code.trim())
        .map(([language, code]) => ({ language, code }));

      const response = await fetch(
        selectedQuestionId ? `${API_BASE}/questions/${selectedQuestionId}` : `${API_BASE}/questions/create`,
        {
          method: selectedQuestionId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...formData, starter_codes: starterCodes }),
        },
      );

      if (!response.ok) {
        throw new Error(`Failed to ${selectedQuestionId ? "update" : "create"} question`);
      }

      const payload = await response.json();
      setSubmitMessage(`Question ${selectedQuestionId ? "updated" : "created"} successfully: ${payload.title}`);
      resetForm();
      await fetchQuestionList();
    } catch (requestError) {
      setSubmitMessage(requestError.message || "Unable to save question");
    } finally {
      setIsSubmitting(false);
    }
  };

  const { topics, companies } = splitTags(formData.tags);

  return (
    <div className="space-y-6">
      <section className="erp-card erp-grid-bg erp-rise-in rounded-[32px] px-6 py-8 md:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.45em] text-teal-700">Question Builder</p>
            <h1 className="mt-3 text-4xl font-extrabold text-slate-900">
              {selectedQuestionId ? "Update question" : "Create and publish questions"}
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-500">
              Manage published and draft questions, including hidden test cases, from one cleaner admin workspace.
            </p>
          </div>
          <div className="flex gap-3">
            {selectedQuestionId && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-full border border-blue-100 bg-white px-4 py-2 text-sm font-semibold text-blue-700"
              >
                New Question
              </button>
            )}
            <button
              onClick={() => navigate("/practice")}
              type="button"
              className="rounded-full border border-blue-100 bg-white px-4 py-2 text-sm font-semibold text-blue-700"
            >
              Back to Questions
            </button>
          </div>
        </div>
      </section>

      <section className="erp-card overflow-hidden rounded-[28px] p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-slate-700">Existing Questions</p>
            <p className="mt-1 text-sm text-slate-500">Load a question for editing or remove it directly.</p>
          </div>
          <div className="rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
            {questionList.length} questions
          </div>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {questionList.map((question) => (
            <div key={question.id} className="rounded-[20px] border border-[#d8e6ff] bg-[#fbfdff] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-base font-bold text-slate-900">{question.title}</p>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-[0.25em] text-blue-600">
                    {question.difficulty} | {question.visibility}
                  </p>
                </div>
                <span className="rounded-full border border-teal-100 bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700">
                  {question.points} pts
                </span>
              </div>
              <p className="mt-3 text-sm text-slate-500">{question.short_description || "No summary provided."}</p>
              {(question.tags || []).length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {question.tags.slice(0, 4).map((tag) => (
                    <span key={tag} className="rounded-full border border-[#d8e6ff] bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => loadQuestion(question.id).catch((error) => setSubmitMessage(error.message))}
                  className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => deleteQuestion(question.id).catch((error) => setSubmitMessage(error.message))}
                  className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-600"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="erp-card overflow-hidden rounded-[28px] p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-slate-700">Featured Tracks</p>
            <p className="mt-1 text-sm text-slate-500">Edit the three premium cards shown on the question bank.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={resetFeaturedTracks}
              className="rounded-full border border-[#d8e6ff] bg-white px-4 py-2 text-sm font-semibold text-slate-700"
            >
              Reset Defaults
            </button>
            <button
              type="button"
              onClick={persistFeaturedTracks}
              className="rounded-full bg-gradient-to-r from-blue-600 to-teal-500 px-4 py-2 text-sm font-bold text-white"
            >
              Save Featured Tracks
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-3">
          {featuredTracks.map((track, index) => {
            const currentAction = track.actionType || "reset";
            const selectedLabel =
              (currentAction === "topic" && topicOptions.find((topic) => topic === track.actionValue)) ||
              (currentAction === "company" && companyOptions.find((company) => company === track.actionValue)) ||
              (currentAction === "savedView" && savedViewOptions.find((item) => item.value === track.actionValue)?.label) ||
              (currentAction === "difficulty" && difficultyOptions.find((item) => item.value === track.actionValue)?.label) ||
              (currentAction === "status" && statusOptions.find((item) => item.value === track.actionValue)?.label) ||
              (currentAction === "progress" && "Saved Progress") ||
              "Reset Filters";
            const metricLabel = getFeaturedTrackMetricLabel(track, featuredPreviewStats);

            return (
              <div key={track.id} className="rounded-[24px] border border-[#d8e6ff] bg-[#fbfdff] p-4">
                <div className={`relative overflow-hidden rounded-[20px] bg-gradient-to-r ${track.accent} p-4 text-white shadow-lg`}>
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.18),transparent_45%)]" />
                  <div className="relative">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/15 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-white/90">
                        <FeaturedTrackGlyph kind={getFeaturedTrackGlyph(track)} className="h-4 w-4" />
                        Premium Track
                      </div>
                      <span className="rounded-full border border-white/20 bg-white/15 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-white/90">
                        {metricLabel}
                      </span>
                    </div>
                    <p className="mt-3 text-xl font-extrabold">{track.title}</p>
                    <p className="mt-2 text-sm text-blue-50">{track.subtitle}</p>
                    <button
                      type="button"
                      className="mt-4 rounded-full bg-white px-4 py-2 text-sm font-bold text-slate-900 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-md"
                    >
                      {track.cta}
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid gap-3">
                  <label className="space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-600">Title</span>
                    <input
                      value={track.title}
                      onChange={(event) => updateFeaturedTrack(index, "title", event.target.value)}
                      className="w-full rounded-2xl border border-[#d8e6ff] bg-white px-4 py-3 text-sm outline-none focus:border-blue-300"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-600">Subtitle</span>
                    <textarea
                      value={track.subtitle}
                      onChange={(event) => updateFeaturedTrack(index, "subtitle", event.target.value)}
                      className="h-24 w-full rounded-2xl border border-[#d8e6ff] bg-white px-4 py-3 text-sm outline-none focus:border-blue-300"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-600">Button Label</span>
                    <input
                      value={track.cta}
                      onChange={(event) => updateFeaturedTrack(index, "cta", event.target.value)}
                      className="w-full rounded-2xl border border-[#d8e6ff] bg-white px-4 py-3 text-sm outline-none focus:border-blue-300"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-600">Card Accent</span>
                    <select
                      value={track.accent}
                      onChange={(event) => updateFeaturedTrack(index, "accent", event.target.value)}
                      className="w-full rounded-2xl border border-[#d8e6ff] bg-white px-4 py-3 text-sm outline-none focus:border-blue-300"
                    >
                      <option value="from-blue-600 via-blue-500 to-cyan-400">Blue Breeze</option>
                      <option value="from-sky-500 via-blue-500 to-teal-500">Sky Stream</option>
                      <option value="from-cyan-500 via-teal-500 to-blue-600">Ocean Flow</option>
                    </select>
                  </label>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-600">Action</span>
                      <select
                        value={track.actionType}
                        onChange={(event) => updateFeaturedTrack(index, "actionType", event.target.value)}
                        className="w-full rounded-2xl border border-[#d8e6ff] bg-white px-4 py-3 text-sm outline-none focus:border-blue-300"
                      >
                        {featuredActionOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-600">Target</span>
                      {track.actionType === "topic" ? (
                        <select
                          value={track.actionValue}
                          onChange={(event) => updateFeaturedTrack(index, "actionValue", event.target.value)}
                          className="w-full rounded-2xl border border-[#d8e6ff] bg-white px-4 py-3 text-sm outline-none focus:border-blue-300"
                        >
                          {topicOptions.length === 0 ? (
                            <option value="">No topics available</option>
                          ) : (
                            topicOptions.map((topic) => (
                              <option key={topic} value={topic}>
                                {topic}
                              </option>
                            ))
                          )}
                        </select>
                      ) : track.actionType === "company" ? (
                        <select
                          value={track.actionValue}
                          onChange={(event) => updateFeaturedTrack(index, "actionValue", event.target.value)}
                          className="w-full rounded-2xl border border-[#d8e6ff] bg-white px-4 py-3 text-sm outline-none focus:border-blue-300"
                        >
                          {companyOptions.length === 0 ? (
                            <option value="">No companies available</option>
                          ) : (
                            companyOptions.map((company) => (
                              <option key={company} value={company}>
                                {company}
                              </option>
                            ))
                          )}
                        </select>
                      ) : track.actionType === "savedView" ? (
                        <select
                          value={track.actionValue}
                          onChange={(event) => updateFeaturedTrack(index, "actionValue", event.target.value)}
                          className="w-full rounded-2xl border border-[#d8e6ff] bg-white px-4 py-3 text-sm outline-none focus:border-blue-300"
                        >
                          {savedViewOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      ) : track.actionType === "difficulty" ? (
                        <select
                          value={track.actionValue}
                          onChange={(event) => updateFeaturedTrack(index, "actionValue", event.target.value)}
                          className="w-full rounded-2xl border border-[#d8e6ff] bg-white px-4 py-3 text-sm outline-none focus:border-blue-300"
                        >
                          {difficultyOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      ) : track.actionType === "status" ? (
                        <select
                          value={track.actionValue}
                          onChange={(event) => updateFeaturedTrack(index, "actionValue", event.target.value)}
                          className="w-full rounded-2xl border border-[#d8e6ff] bg-white px-4 py-3 text-sm outline-none focus:border-blue-300"
                        >
                          {statusOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          value={track.actionValue}
                          onChange={(event) => updateFeaturedTrack(index, "actionValue", event.target.value)}
                          className="w-full rounded-2xl border border-[#d8e6ff] bg-white px-4 py-3 text-sm outline-none focus:border-blue-300"
                          placeholder={currentAction === "progress" ? "No target needed" : "Reset to default"}
                          disabled={currentAction === "progress" || currentAction === "reset"}
                        />
                      )}
                    </label>
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
                    Current action: {selectedLabel}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
        {featuredMessage && <p className="mt-4 text-sm font-semibold text-slate-700">{featuredMessage}</p>}
      </section>

      <form className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]" onSubmit={handleSubmit}>
        <div className="space-y-6">
          <section className="erp-card overflow-hidden rounded-[28px] p-6">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-semibold text-slate-700">Title</span>
                <input
                  value={formData.title}
                  onChange={(event) => updateField("title", event.target.value)}
                  className="w-full rounded-2xl border border-[#d8e6ff] bg-[#fbfdff] px-4 py-3 outline-none focus:border-blue-300"
                  required
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold text-slate-700">Short Description</span>
                <input
                  value={formData.short_description}
                  onChange={(event) => updateField("short_description", event.target.value)}
                  className="w-full rounded-2xl border border-[#d8e6ff] bg-[#fbfdff] px-4 py-3 outline-none focus:border-blue-300"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold text-slate-700">Diagram / Image URL</span>
                <input
                  value={formData.diagram_url}
                  onChange={(event) => updateField("diagram_url", event.target.value)}
                  className="w-full rounded-2xl border border-[#d8e6ff] bg-[#fbfdff] px-4 py-3 outline-none focus:border-blue-300"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold text-slate-700">Diagram Caption</span>
                <input
                  value={formData.diagram_caption}
                  onChange={(event) => updateField("diagram_caption", event.target.value)}
                  className="w-full rounded-2xl border border-[#d8e6ff] bg-[#fbfdff] px-4 py-3 outline-none focus:border-blue-300"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold text-slate-700">Difficulty</span>
                <select
                  value={formData.difficulty}
                  onChange={(event) => updateField("difficulty", event.target.value)}
                  className="w-full rounded-2xl border border-[#d8e6ff] bg-[#fbfdff] px-4 py-3 outline-none focus:border-blue-300"
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold text-slate-700">Category</span>
                <select
                  value={formData.category}
                  onChange={(event) => updateField("category", event.target.value)}
                  className="w-full rounded-2xl border border-[#d8e6ff] bg-[#fbfdff] px-4 py-3 outline-none focus:border-blue-300"
                >
                  <option value="coding">Coding</option>
                  <option value="sql">SQL</option>
                  <option value="mcq">MCQ</option>
                  <option value="debugging">Debugging</option>
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold text-slate-700">Visibility</span>
                <select
                  value={formData.visibility}
                  onChange={(event) => updateField("visibility", event.target.value)}
                  className="w-full rounded-2xl border border-[#d8e6ff] bg-[#fbfdff] px-4 py-3 outline-none focus:border-blue-300"
                >
                  <option value="published">Published</option>
                  <option value="draft">Draft</option>
                  <option value="private">Private</option>
                </select>
              </label>
            </div>
            {formData.diagram_url && (
              <div className="mt-5 rounded-[24px] border border-blue-100 bg-blue-50/60 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-600">Diagram Preview</p>
                <img
                  src={formData.diagram_url}
                  alt={formData.diagram_caption || formData.title || "Question diagram"}
                  className="mt-3 max-h-64 w-full rounded-2xl border border-blue-100 bg-white object-contain"
                />
                {formData.diagram_caption && <p className="mt-3 text-sm text-slate-600">{formData.diagram_caption}</p>}
              </div>
            )}
          </section>

          <section className="erp-card overflow-hidden rounded-[28px] p-6">
            <p className="text-sm font-semibold text-slate-700">Problem Statement</p>
            <textarea
              value={formData.problem_statement}
              onChange={(event) => updateField("problem_statement", event.target.value)}
              className="mt-3 h-44 w-full rounded-[24px] border border-[#d8e6ff] bg-[#fbfdff] px-4 py-4 outline-none focus:border-blue-300"
              required
            />
          </section>

          <section className="erp-card overflow-hidden rounded-[28px] p-6">
            <div className="grid gap-4 md:grid-cols-2">
              <textarea
                value={formData.input_format}
                onChange={(event) => updateField("input_format", event.target.value)}
                className="h-32 rounded-[24px] border border-[#d8e6ff] bg-[#fbfdff] px-4 py-4 outline-none focus:border-blue-300"
                placeholder="Input format"
              />
              <textarea
                value={formData.output_format}
                onChange={(event) => updateField("output_format", event.target.value)}
                className="h-32 rounded-[24px] border border-[#d8e6ff] bg-[#fbfdff] px-4 py-4 outline-none focus:border-blue-300"
                placeholder="Output format"
              />
              {formData.category === "sql" ? (
                <>
                  <textarea
                    value={formData.sql_schema}
                    onChange={(event) => updateField("sql_schema", event.target.value)}
                    className="h-36 rounded-[24px] border border-[#d8e6ff] bg-[#fbfdff] px-4 py-4 outline-none focus:border-blue-300 md:col-span-2"
                    placeholder="SQL schema / required tables"
                  />
                  <textarea
                    value={formData.expected_output}
                    onChange={(event) => updateField("expected_output", event.target.value)}
                    className="h-28 rounded-[24px] border border-[#d8e6ff] bg-[#fbfdff] px-4 py-4 outline-none focus:border-blue-300 md:col-span-2"
                    placeholder="Expected output snapshot"
                  />
                </>
              ) : (
                <textarea
                  value={formData.function_signature}
                  onChange={(event) => updateField("function_signature", event.target.value)}
                  className="h-28 rounded-[24px] border border-[#d8e6ff] bg-[#fbfdff] px-4 py-4 outline-none focus:border-blue-300 md:col-span-2"
                  placeholder="Function signature"
                />
              )}
              <textarea
                value={formData.constraints}
                onChange={(event) => updateField("constraints", event.target.value)}
                className="h-28 rounded-[24px] border border-[#d8e6ff] bg-[#fbfdff] px-4 py-4 outline-none focus:border-blue-300 md:col-span-2"
                placeholder="Constraints"
              />
            </div>
          </section>

          {formData.category === "sql" && (
            <section className="erp-card overflow-hidden rounded-[28px] p-6">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-700">Sample Tables</p>
                <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                  {(formData.sample_tables || []).length} tables
                </span>
              </div>
              <div className="mt-4 space-y-3">
                <input
                  value={sampleTableInput.name}
                  onChange={(event) => setSampleTableInput((current) => ({ ...current, name: event.target.value }))}
                  className="w-full rounded-2xl border border-[#d8e6ff] bg-[#fbfdff] px-4 py-3 outline-none focus:border-blue-300"
                  placeholder="Table name"
                />
                <input
                  value={sampleTableInput.columns}
                  onChange={(event) => setSampleTableInput((current) => ({ ...current, columns: event.target.value }))}
                  className="w-full rounded-2xl border border-[#d8e6ff] bg-[#fbfdff] px-4 py-3 outline-none focus:border-blue-300"
                  placeholder="Columns separated by commas, for example: id,name,salary"
                />
                <textarea
                  value={sampleTableInput.rows}
                  onChange={(event) => setSampleTableInput((current) => ({ ...current, rows: event.target.value }))}
                  className="h-28 w-full rounded-[20px] border border-[#d8e6ff] bg-[#fbfdff] px-4 py-4 font-mono text-sm outline-none focus:border-blue-300"
                  placeholder='Rows JSON, for example: [["1","Asha","100"],["2","Rahul","300"]]'
                />
                <button type="button" onClick={addSampleTable} className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-bold text-white">
                  Add Sample Table
                </button>
              </div>

              <div className="mt-5 space-y-4">
                {(formData.sample_tables || []).map((table, index) => (
                  <div key={`${table.name}-${index}`} className="rounded-[20px] border border-[#d8e6ff] bg-[#fbfdff] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-slate-900">{table.name}</p>
                        <p className="mt-1 text-xs text-slate-500">{(table.columns || []).join(", ")}</p>
                      </div>
                      <button type="button" onClick={() => removeSampleTable(index)} className="text-xs font-semibold text-rose-600">
                        Remove
                      </button>
                    </div>
                    <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                      <table className="min-w-full text-left text-sm text-slate-700">
                        <thead className="bg-slate-50 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                          <tr>
                            {(table.columns || []).map((column) => (
                              <th key={column} className="px-4 py-3">
                                {column}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {(table.rows || []).map((row, rowIndex) => (
                            <tr key={`${table.name}-${rowIndex}`} className="border-t border-slate-100">
                              {row.map((cell, cellIndex) => (
                                <td key={`${table.name}-${rowIndex}-${cellIndex}`} className="px-4 py-3">
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="space-y-6">
          <section className="erp-card overflow-hidden rounded-[28px] p-6">
            <p className="text-sm font-semibold text-slate-700">Topics</p>
            <div className="mt-3 flex gap-2">
              <input
                value={tagInput}
                onChange={(event) => setTagInput(event.target.value)}
                className="flex-1 rounded-2xl border border-[#d8e6ff] bg-[#fbfdff] px-4 py-3 outline-none focus:border-blue-300"
                placeholder="Add tag"
              />
              <button type="button" onClick={addTag} className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-bold text-white">
                Add
              </button>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {topics.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="rounded-full border border-teal-100 bg-teal-50 px-3 py-2 text-xs font-semibold text-teal-700"
                >
                  {tag} x
                </button>
              ))}
            </div>
          </section>

          <section className="erp-card overflow-hidden rounded-[28px] p-6">
            <p className="text-sm font-semibold text-slate-700">Companies Asked</p>
            <div className="mt-3 flex gap-2">
              <input
                value={companyInput}
                onChange={(event) => setCompanyInput(event.target.value)}
                className="flex-1 rounded-2xl border border-[#d8e6ff] bg-[#fbfdff] px-4 py-3 outline-none focus:border-blue-300"
                placeholder="Add company name"
              />
              <button type="button" onClick={addCompany} className="rounded-2xl bg-teal-600 px-4 py-3 text-sm font-bold text-white">
                Add
              </button>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {companies.map((company) => (
                <button
                  key={company}
                  type="button"
                  onClick={() => removeTag(`${companyPrefix}${company}`)}
                  className="rounded-full border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700"
                >
                  {company} x
                </button>
              ))}
            </div>
          </section>

          <section className="erp-card overflow-hidden rounded-[28px] p-6">
            <p className="text-sm font-semibold text-slate-700">Examples</p>
            <div className="mt-3 space-y-3">
              <textarea
                value={exampleInput.input}
                onChange={(event) => setExampleInput((current) => ({ ...current, input: event.target.value }))}
                className="h-24 w-full rounded-2xl border border-[#d8e6ff] bg-[#fbfdff] px-4 py-3 outline-none focus:border-blue-300"
                placeholder="Example input"
              />
              <textarea
                value={exampleInput.output}
                onChange={(event) => setExampleInput((current) => ({ ...current, output: event.target.value }))}
                className="h-24 w-full rounded-2xl border border-[#d8e6ff] bg-[#fbfdff] px-4 py-3 outline-none focus:border-blue-300"
                placeholder="Example output"
              />
              <input
                value={exampleInput.explanation}
                onChange={(event) => setExampleInput((current) => ({ ...current, explanation: event.target.value }))}
                className="w-full rounded-2xl border border-[#d8e6ff] bg-[#fbfdff] px-4 py-3 outline-none focus:border-blue-300"
                placeholder="Explanation"
              />
              <button type="button" onClick={addExample} className="rounded-2xl bg-teal-600 px-4 py-3 text-sm font-bold text-white">
                Add Example
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {formData.examples.map((example, index) => (
                <div key={`${example.input}-${index}`} className="rounded-[18px] border border-[#d8e6ff] bg-[#fbfdff] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900">Example {index + 1}</p>
                      <p className="mt-2 text-xs text-slate-500">Input: {example.input}</p>
                      <p className="mt-1 text-xs text-slate-500">Output: {example.output}</p>
                    </div>
                    <button type="button" onClick={() => removeExample(index)} className="text-xs font-semibold text-rose-600">
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="erp-card overflow-hidden rounded-[28px] p-6">
            <p className="text-sm font-semibold text-slate-700">
              {formData.category === "sql" ? "Validation Cases (Optional)" : "Test Cases"}
            </p>
            <div className="mt-3 space-y-3">
              <textarea
                value={testCaseInput.input}
                onChange={(event) => setTestCaseInput((current) => ({ ...current, input: event.target.value }))}
                className="h-24 w-full rounded-2xl border border-[#d8e6ff] bg-[#fbfdff] px-4 py-3 outline-none focus:border-blue-300"
                placeholder={formData.category === "sql" ? "Optional validation note or case name" : "Test case input"}
              />
              <textarea
                value={testCaseInput.output}
                onChange={(event) => setTestCaseInput((current) => ({ ...current, output: event.target.value }))}
                className="h-24 w-full rounded-2xl border border-[#d8e6ff] bg-[#fbfdff] px-4 py-3 outline-none focus:border-blue-300"
                placeholder={formData.category === "sql" ? "Optional expected validation output" : "Expected output"}
              />
              <label className="flex items-center gap-3 text-sm font-medium text-slate-600">
                <input
                  type="checkbox"
                  checked={testCaseInput.is_hidden}
                  onChange={(event) => setTestCaseInput((current) => ({ ...current, is_hidden: event.target.checked }))}
                />
                Hidden test case
              </label>
              <button type="button" onClick={addTestCase} className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-bold text-white">
                Add Test Case
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {formData.test_cases.map((testCase, index) => (
                <div key={`${testCase.input}-${index}`} className="rounded-[18px] border border-[#d8e6ff] bg-[#fbfdff] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900">
                        Test Case {index + 1} {testCase.is_hidden ? "(Hidden)" : "(Visible)"}
                      </p>
                      <p className="mt-2 text-xs text-slate-500">Input: {testCase.input}</p>
                      <p className="mt-1 text-xs text-slate-500">Expected: {testCase.output}</p>
                    </div>
                    <button type="button" onClick={() => removeTestCase(index)} className="text-xs font-semibold text-rose-600">
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="erp-card overflow-hidden rounded-[28px] p-6">
            <p className="text-sm font-semibold text-slate-700">
              {formData.category === "sql" ? "SQL Starter Query" : "Starter Code Templates"}
            </p>
            <div className="mt-4 space-y-4">
              {(formData.category === "sql" ? ["sql"] : ["python", "javascript", "java", "cpp"]).map((language) => (
                <div key={language}>
                  <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-600">{language}</p>
                  <textarea
                    value={formData.starter_codes[language]}
                    onChange={(event) =>
                      setFormData((current) => ({
                        ...current,
                        starter_codes: { ...current.starter_codes, [language]: event.target.value },
                      }))
                    }
                    className="mt-2 h-28 w-full rounded-[20px] border border-[#d8e6ff] bg-[#fbfdff] px-4 py-4 font-mono text-sm outline-none focus:border-blue-300"
                  />
                </div>
              ))}
            </div>
          </section>

          <section className="erp-card overflow-hidden rounded-[28px] p-6">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-700">
                {formData.category === "sql" ? "Accepted SQL Solutions" : "Reference Solutions"}
              </p>
              <button type="button" onClick={addSolution} className="rounded-2xl bg-teal-600 px-4 py-2 text-sm font-bold text-white">
                Add Solution
              </button>
            </div>
            <div className="mt-4 space-y-4">
              {formData.solutions.length === 0 ? (
                <p className="text-sm text-slate-500">No solution added yet. Students will only see it after passing all tests.</p>
              ) : (
                formData.solutions.map((solution, index) => (
                  <div key={`solution-${index}`} className="rounded-[20px] border border-[#d8e6ff] bg-[#fbfdff] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-bold text-slate-900">Solution {index + 1}</p>
                      <button type="button" onClick={() => removeSolution(index)} className="text-xs font-semibold text-rose-600">
                        Remove
                      </button>
                    </div>
                    <select
                      value={solution.language || (formData.category === "sql" ? "sql" : "python")}
                      onChange={(event) => updateSolution(index, "language", event.target.value)}
                      className="mt-3 w-full rounded-2xl border border-[#d8e6ff] bg-white px-4 py-3 outline-none focus:border-blue-300"
                    >
                      {formData.category === "sql" ? (
                        <option value="sql">SQL</option>
                      ) : (
                        <>
                          <option value="python">Python</option>
                          <option value="javascript">JavaScript</option>
                          <option value="java">Java</option>
                          <option value="cpp">C++</option>
                        </>
                      )}
                    </select>
                    <select
                      value={solution.approach_type}
                      onChange={(event) => updateSolution(index, "approach_type", event.target.value)}
                      className="mt-3 w-full rounded-2xl border border-[#d8e6ff] bg-white px-4 py-3 outline-none focus:border-blue-300"
                    >
                      <option value="optimized">Optimized</option>
                      <option value="brute_force">Brute Force</option>
                    </select>
                    <textarea
                      value={solution.code}
                      onChange={(event) => updateSolution(index, "code", event.target.value)}
                      className="mt-3 h-32 w-full rounded-[20px] border border-[#d8e6ff] bg-white px-4 py-4 font-mono text-sm outline-none focus:border-blue-300"
                      placeholder="Reference code"
                    />
                    <textarea
                      value={solution.explanation}
                      onChange={(event) => updateSolution(index, "explanation", event.target.value)}
                      className="mt-3 h-24 w-full rounded-[20px] border border-[#d8e6ff] bg-white px-4 py-4 text-sm outline-none focus:border-blue-300"
                      placeholder="Explanation"
                    />
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        <div className="xl:col-span-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-2xl bg-gradient-to-r from-blue-600 to-teal-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Saving..." : selectedQuestionId ? "Update Question" : "Create Question"}
          </button>
          {submitMessage && <p className="mt-4 text-sm font-semibold text-slate-700">{submitMessage}</p>}
        </div>
      </form>
    </div>
  );
};

export default PracticeArenaAdmin;
