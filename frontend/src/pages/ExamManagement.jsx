import React, { useEffect, useMemo, useState } from "react";
import { apiPost, apiPut } from "../utils/api";
import { getAccessToken, getStoredUser } from "../utils/roleHelper";
import { getPortalBootstrap, invalidatePortalBootstrap } from "../utils/portalBootstrap";

const createBlankQuestionOption = (index) => ({ id: String.fromCharCode(97 + index), label: "" });

const createManualQuestionForm = () => ({
  title: "",
  question_type: "mcq",
  difficulty: "medium",
  tagsInput: "",
  short_description: "",
  prompt: "",
  instructions: "",
  image_url: "",
  image_caption: "",
  points: 10,
  question_timer_minutes: "",
  evaluation_guide: "",
  input_format: "",
  output_format: "",
  constraints: "",
  function_signature: "",
  expected_output: "",
  sample_tables: [],
  sampleTableDraft: { name: "", columns: "", rowsText: '[["1","Asha","100"]]' },
  options: [createBlankQuestionOption(0), createBlankQuestionOption(1), createBlankQuestionOption(2), createBlankQuestionOption(3)],
  correct_answers: [],
  examples: [{ input: "", output: "", explanation: "" }],
  visible_test_cases: [{ input: "", output: "" }],
  hidden_test_cases: [{ input: "", output: "" }],
  allowed_languages: ["python", "javascript"],
  starter_code: {
    python: "def solve(*args, **kwargs):\n    pass",
    javascript: "function solve(...args) {\n  return null;\n}\n",
    java: "",
    cpp: "",
    c: "",
    sql: "SELECT *\nFROM your_table;",
  },
});

const createExamForm = () => {
  const start = new Date(Date.now() + 60 * 60 * 1000);
  const end = new Date(start.getTime() + 90 * 60 * 1000);
  return {
    title: "",
    description: "",
    instructions: "",
    exam_password: "",
    start_time: start.toISOString().slice(0, 16),
    end_time: end.toISOString().slice(0, 16),
    duration_minutes: 90,
    status: "draft",
    access_scope: "hybrid",
    shuffle_questions: true,
    shuffle_mcq_options: true,
    allow_late_entry: true,
    late_entry_grace_minutes: 15,
    show_score_immediately: false,
    auto_submit_enabled: true,
    allow_post_exam_review: true,
    show_answer_key_in_review: false,
    show_score_in_review: true,
    selected_question_ids: [],
    question_settings: {},
    faculty_ids: [],
    selected_student_ids: [],
    selected_department_codes: [],
    settingsText: JSON.stringify({ faculty_preview_enabled: true, malpractice_review_enabled: true }, null, 2),
  };
};

const difficultyOptions = ["easy", "medium", "hard"];
const questionTypes = ["mcq", "written", "coding", "sql"];
const languageOptions = ["python", "javascript", "java", "cpp", "c"];
const sourceTone = {
  exam_portal: "bg-blue-50 text-blue-700 border-blue-100",
  practice_arena: "bg-teal-50 text-teal-700 border-teal-100",
};

const parseJson = (value, fallback = {}) => {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    throw new Error("One of the JSON fields is invalid");
  }
};

const parseRowsJson = (value) => {
  try {
    const rows = JSON.parse(value || "[]");
    if (!Array.isArray(rows)) throw new Error();
    return rows;
  } catch {
    throw new Error("Sample table rows must be valid JSON");
  }
};

const cleanExamples = (items = []) =>
  items
    .map((item) => ({ input: item.input?.trim() || "", output: item.output?.trim() || "", explanation: item.explanation?.trim() || "" }))
    .filter((item) => item.input || item.output || item.explanation);

const cleanTestCases = (items = []) =>
  items
    .map((item) => ({ input: item.input?.trim() || "", output: item.output?.trim() || "" }))
    .filter((item) => item.input || item.output);

const ExamManagement = () => {
  const user = getStoredUser();
  const [bootstrap, setBootstrap] = useState({ exams: [], question_bank: [], practice_bank: [], students: [], faculty: [], departments: [] });
  const [manualQuestionForm, setManualQuestionForm] = useState(createManualQuestionForm());
  const [examForm, setExamForm] = useState(createExamForm());
  const [editingQuestionId, setEditingQuestionId] = useState(null);
  const [editingExamId, setEditingExamId] = useState(null);
  const [activeTab, setActiveTab] = useState("exams");
  const [questionBuilderTab, setQuestionBuilderTab] = useState("manual");
  const [questionSearch, setQuestionSearch] = useState("");
  const [practiceSearch, setPracticeSearch] = useState("");
  const [practiceSelection, setPracticeSelection] = useState([]);
  const [bulkImportFile, setBulkImportFile] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [bulkImporting, setBulkImporting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const loadBootstrap = async () => {
    setLoading(true);
    setError("");
    try {
      setBootstrap(await getPortalBootstrap({ force: true }));
    } catch (requestError) {
      setError(requestError.message || "Unable to load exam portal data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBootstrap();
  }, []);

  const questionBank = bootstrap.question_bank || [];
  const practiceBank = bootstrap.practice_bank || [];
  const exams = bootstrap.exams || [];

  const examStats = useMemo(() => ({
    publishedExams: exams.filter((item) => item.status === "published").length,
    totalExamBank: questionBank.length,
    practiceReady: practiceBank.length,
    totalExams: exams.length,
  }), [exams, questionBank.length, practiceBank.length]);

  const filteredQuestionBank = useMemo(() => {
    const needle = questionSearch.trim().toLowerCase();
    if (!needle) return questionBank;
    return questionBank.filter((question) =>
      [question.title, question.short_description, question.question_type, ...(question.tags || [])]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle)),
    );
  }, [questionBank, questionSearch]);

  const filteredPracticeBank = useMemo(() => {
    const needle = practiceSearch.trim().toLowerCase();
    if (!needle) return practiceBank;
    return practiceBank.filter((question) =>
      [question.title, question.short_description, question.category, ...(question.tags || [])]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle)),
    );
  }, [practiceBank, practiceSearch]);

  const selectedExamQuestions = useMemo(
    () => examForm.selected_question_ids.map((questionId) => questionBank.find((question) => question.id === questionId)).filter(Boolean),
    [examForm.selected_question_ids, questionBank],
  );

  const updateManualQuestion = (field, value) => setManualQuestionForm((current) => ({ ...current, [field]: value }));

  const updateManualArrayItem = (field, index, patch) =>
    setManualQuestionForm((current) => ({
      ...current,
      [field]: current[field].map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    }));

  const addManualArrayItem = (field, factory) =>
    setManualQuestionForm((current) => ({ ...current, [field]: [...current[field], factory(current[field].length)] }));

  const removeManualArrayItem = (field, index) =>
    setManualQuestionForm((current) => ({ ...current, [field]: current[field].filter((_, itemIndex) => itemIndex !== index) }));

  const buildQuestionPayload = () => {
    const tags = manualQuestionForm.tagsInput.split(",").map((item) => item.trim()).filter(Boolean);
    const options = manualQuestionForm.options
      .map((option, index) => ({ id: option.id || String.fromCharCode(97 + index), label: option.label.trim() }))
      .filter((option) => option.label);
    return {
      title: manualQuestionForm.title.trim(),
      question_type: manualQuestionForm.question_type,
      difficulty: manualQuestionForm.difficulty,
      tags,
      prompt: manualQuestionForm.prompt,
      instructions: manualQuestionForm.instructions,
      options: manualQuestionForm.question_type === "mcq" ? options : [],
      correct_answers: manualQuestionForm.question_type === "mcq" ? manualQuestionForm.correct_answers : [],
      evaluation_guide: manualQuestionForm.evaluation_guide,
      answer_schema: {
        allowed_languages:
          manualQuestionForm.question_type === "sql"
            ? ["sql"]
            : manualQuestionForm.question_type === "coding"
              ? manualQuestionForm.allowed_languages
              : [],
        starter_code:
          manualQuestionForm.question_type === "sql"
            ? { sql: manualQuestionForm.starter_code.sql }
            : manualQuestionForm.question_type === "coding"
              ? Object.fromEntries(
                  Object.entries(manualQuestionForm.starter_code).filter(
                    ([language, code]) => manualQuestionForm.allowed_languages.includes(language) && code.trim(),
                  ),
                )
              : {},
        selection_mode: manualQuestionForm.correct_answers.length > 1 ? "multiple" : "single",
      },
      metadata: {
        short_description: manualQuestionForm.short_description.trim(),
        image_url: manualQuestionForm.image_url.trim(),
        image_caption: manualQuestionForm.image_caption.trim(),
        examples: cleanExamples(manualQuestionForm.examples),
        visible_test_cases: cleanTestCases(manualQuestionForm.visible_test_cases),
        hidden_test_cases: cleanTestCases(manualQuestionForm.hidden_test_cases),
        sample_tables: manualQuestionForm.sample_tables,
        expected_output: manualQuestionForm.expected_output.trim(),
        input_format: manualQuestionForm.input_format.trim(),
        output_format: manualQuestionForm.output_format.trim(),
        constraints: manualQuestionForm.constraints.trim(),
        function_signature: manualQuestionForm.function_signature.trim(),
        question_timer_minutes: manualQuestionForm.question_timer_minutes ? Number(manualQuestionForm.question_timer_minutes) : null,
        source_type: "exam_portal",
      },
      points: Number(manualQuestionForm.points),
      created_by: user.id,
    };
  };

  const resetQuestionBuilder = () => {
    setManualQuestionForm(createManualQuestionForm());
    setEditingQuestionId(null);
  };

  const handleQuestionSubmit = async (event) => {
    event.preventDefault();
    setStatusMessage("");
    setError("");
    try {
      const payload = buildQuestionPayload();
      if (editingQuestionId) {
        await apiPut(`/portal/questions/${editingQuestionId}`, payload, { wrapData: false });
        setStatusMessage("Question bank item updated");
      } else {
        await apiPost("/portal/questions", payload);
        setStatusMessage("Question bank item created");
      }
      invalidatePortalBootstrap();
      resetQuestionBuilder();
      await loadBootstrap();
    } catch (requestError) {
      setError(requestError.message || "Unable to save question");
    }
  };

  const addSampleTable = () => {
    setError("");
    try {
      const nextTable = {
        name: manualQuestionForm.sampleTableDraft.name.trim(),
        columns: manualQuestionForm.sampleTableDraft.columns.split(",").map((item) => item.trim()).filter(Boolean),
        rows: parseRowsJson(manualQuestionForm.sampleTableDraft.rowsText),
      };
      if (!nextTable.name || nextTable.columns.length === 0) return;
      setManualQuestionForm((current) => ({
        ...current,
        sample_tables: [...current.sample_tables, nextTable],
        sampleTableDraft: { name: "", columns: "", rowsText: '[["1","Asha","100"]]' },
      }));
    } catch (requestError) {
      setError(requestError.message || "Unable to add sample table");
    }
  };

  const uploadQuestionImage = async (file) => {
    if (!file) return;
    setUploadingImage(true);
    setError("");
    setStatusMessage("");
    try {
      const formData = new FormData();
      formData.append("image", file);
      const token = getAccessToken();
      const response = await fetch("http://127.0.0.1:8000/portal/question-assets/image", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.detail || "Unable to upload image");
      }
      const payload = await response.json();
      setManualQuestionForm((current) => ({ ...current, image_url: payload.url }));
      setStatusMessage("Question image uploaded");
    } catch (requestError) {
      setError(requestError.message || "Unable to upload image");
    } finally {
      setUploadingImage(false);
    }
  };

  const importSelectedPracticeQuestions = async () => {
    if (practiceSelection.length === 0) return;
    setStatusMessage("");
    setError("");
    try {
      const payload = await apiPost("/portal/questions/import-practice", { question_ids: practiceSelection });
      setPracticeSelection([]);
      setQuestionBuilderTab("library");
      setStatusMessage(`${payload.items.length} practice question(s) imported into the exam bank`);
      invalidatePortalBootstrap();
      await loadBootstrap();
    } catch (requestError) {
      setError(requestError.message || "Unable to import practice questions");
    }
  };

  const downloadBulkTemplate = async () => {
    setError("");
    try {
      const token = getAccessToken();
      const response = await fetch("http://127.0.0.1:8000/portal/questions/bulk-template", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) {
        throw new Error("Unable to download template");
      }
      const text = await response.text();
      const blob = new Blob([text], { type: "text/csv" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "exam-question-bank-template.csv";
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (requestError) {
      setError(requestError.message || "Unable to download template");
    }
  };

  const bulkImportQuestions = async () => {
    if (!bulkImportFile) return;
    setBulkImporting(true);
    setError("");
    setStatusMessage("");
    try {
      const formData = new FormData();
      formData.append("file", bulkImportFile);
      const token = getAccessToken();
      const response = await fetch("http://127.0.0.1:8000/portal/questions/bulk-import", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.detail || "Unable to bulk import questions");
      }
      const payload = await response.json();
      setBulkImportFile(null);
      setStatusMessage(`${payload.items.length} questions imported into the exam bank`);
      setQuestionBuilderTab("library");
      invalidatePortalBootstrap();
      await loadBootstrap();
    } catch (requestError) {
      setError(requestError.message || "Unable to bulk import questions");
    } finally {
      setBulkImporting(false);
    }
  };

  const hydrateQuestionForm = (question) => {
    const metadata = question.metadata || {};
    const starterCode = question.answer_schema?.starter_code || {};
    setManualQuestionForm({
      title: question.title || "",
      question_type: question.question_type,
      difficulty: question.difficulty || "medium",
      tagsInput: (question.tags || []).join(", "),
      short_description: metadata.short_description || "",
      prompt: question.prompt || "",
      instructions: question.instructions || "",
      image_url: metadata.image_url || "",
      image_caption: metadata.image_caption || "",
      points: question.points || 10,
      question_timer_minutes: metadata.question_timer_minutes || "",
      evaluation_guide: question.evaluation_guide || "",
      input_format: metadata.input_format || "",
      output_format: metadata.output_format || "",
      constraints: metadata.constraints || "",
      function_signature: metadata.function_signature || "",
      expected_output: metadata.expected_output || "",
      sample_tables: metadata.sample_tables || [],
      sampleTableDraft: { name: "", columns: "", rowsText: '[["1","Asha","100"]]' },
      options: (question.options || []).length > 0 ? question.options : [createBlankQuestionOption(0), createBlankQuestionOption(1), createBlankQuestionOption(2), createBlankQuestionOption(3)],
      correct_answers: question.correct_answers || [],
      examples: metadata.examples?.length ? metadata.examples : [{ input: "", output: "", explanation: "" }],
      visible_test_cases: metadata.visible_test_cases?.length ? metadata.visible_test_cases : [{ input: "", output: "" }],
      hidden_test_cases: metadata.hidden_test_cases?.length ? metadata.hidden_test_cases : [{ input: "", output: "" }],
      allowed_languages:
        question.question_type === "sql"
          ? ["sql"]
          : question.answer_schema?.allowed_languages?.length
            ? question.answer_schema.allowed_languages
            : ["python", "javascript"],
      starter_code: {
        python: starterCode.python || "def solve(*args, **kwargs):\n    pass",
        javascript: starterCode.javascript || "function solve(...args) {\n  return null;\n}\n",
        java: starterCode.java || "",
        cpp: starterCode.cpp || "",
        c: starterCode.c || "",
        sql: starterCode.sql || "SELECT *\nFROM your_table;",
      },
    });
  };

  const startQuestionEdit = (question) => {
    setEditingQuestionId(question.id);
    hydrateQuestionForm(question);
    setActiveTab("questions");
    setQuestionBuilderTab("manual");
  };

  const toggleExamQuestion = (questionId) => {
    setExamForm((current) => {
      const exists = current.selected_question_ids.includes(questionId);
      const nextIds = exists ? current.selected_question_ids.filter((item) => item !== questionId) : [...current.selected_question_ids, questionId];
      const question = questionBank.find((item) => item.id === questionId);
      const nextSettings = { ...current.question_settings };
      if (!exists) {
        nextSettings[questionId] = nextSettings[questionId] || {
          section_name: question?.question_type === "mcq" ? "Objective Section" : "Assessment Section",
          points: question?.points || 10,
          required: true,
          question_duration_minutes: question?.question_timer_minutes || "",
        };
      } else {
        delete nextSettings[questionId];
      }
      return { ...current, selected_question_ids: nextIds, question_settings: nextSettings };
    });
  };

  const updateExamQuestionSetting = (questionId, patch) =>
    setExamForm((current) => ({
      ...current,
      question_settings: { ...current.question_settings, [questionId]: { ...(current.question_settings[questionId] || {}), ...patch } },
    }));

  const handleExamSubmit = async (event) => {
    event.preventDefault();
    setStatusMessage("");
    setError("");
    try {
      const questionLinks = examForm.selected_question_ids.map((questionId, index) => {
        const question = questionBank.find((item) => item.id === questionId);
        const config = examForm.question_settings[questionId] || {};
        return {
          question_id: questionId,
          section_name: config.section_name || (question?.question_type === "mcq" ? "Objective Section" : "Assessment Section"),
          order_index: index + 1,
          points: Number(config.points || question?.points || 10),
          required: config.required !== false,
          settings: { question_duration_minutes: config.question_duration_minutes ? Number(config.question_duration_minutes) : null },
        };
      });
      const extraSettings = parseJson(examForm.settingsText, {});
      const payload = {
        title: examForm.title,
        description: examForm.description,
        instructions: examForm.instructions,
        exam_password: examForm.exam_password,
        start_time: new Date(examForm.start_time).toISOString(),
        end_time: new Date(examForm.end_time).toISOString(),
        duration_minutes: Number(examForm.duration_minutes),
        status: examForm.status,
        access_scope: examForm.access_scope,
        shuffle_questions: examForm.shuffle_questions,
        shuffle_mcq_options: examForm.shuffle_mcq_options,
        allow_late_entry: examForm.allow_late_entry,
        late_entry_grace_minutes: Number(examForm.late_entry_grace_minutes),
        show_score_immediately: examForm.show_score_immediately,
        auto_submit_enabled: examForm.auto_submit_enabled,
        settings: {
          ...extraSettings,
          allow_post_exam_review: examForm.allow_post_exam_review,
          show_answer_key_in_review: examForm.show_answer_key_in_review,
          show_score_in_review: examForm.show_score_in_review,
        },
        created_by: user.id,
        question_links: questionLinks,
        faculty_access: examForm.faculty_ids.map((facultyId) => ({ user_id: facultyId, can_manage: true, can_test: true, can_review: true, can_download: true })),
        selected_student_ids: examForm.selected_student_ids,
        selected_department_codes: examForm.selected_department_codes,
      };
      if (editingExamId) {
        await apiPut(`/portal/exams/${editingExamId}`, payload, { wrapData: false });
        setStatusMessage("Exam updated");
      } else {
        await apiPost("/portal/exams", payload);
        setStatusMessage("Exam created");
      }
      invalidatePortalBootstrap();
      setExamForm(createExamForm());
      setEditingExamId(null);
      await loadBootstrap();
    } catch (requestError) {
      setError(requestError.message || "Unable to save exam");
    }
  };

  const startExamEdit = (exam) => {
    const questionSettings = {};
    const reviewPolicy = exam.review_policy || {};
    const extraSettings = { ...(exam.settings || {}) };
    delete extraSettings.allow_post_exam_review;
    delete extraSettings.show_answer_key_in_review;
    delete extraSettings.show_score_in_review;
    exam.question_links.forEach((link) => {
      questionSettings[link.question.id] = {
        section_name: link.section_name,
        points: link.points,
        required: link.required,
        question_duration_minutes: link.question_duration_minutes || link.settings?.question_duration_minutes || "",
      };
    });
    setEditingExamId(exam.id);
    setExamForm({
      title: exam.title,
      description: exam.description || "",
      instructions: exam.instructions || "",
      exam_password: "",
      start_time: exam.start_time?.slice(0, 16) || "",
      end_time: exam.end_time?.slice(0, 16) || "",
      duration_minutes: exam.duration_minutes,
      status: exam.status,
      access_scope: exam.access_scope,
      shuffle_questions: exam.shuffle_questions,
      shuffle_mcq_options: exam.shuffle_mcq_options,
      allow_late_entry: exam.allow_late_entry,
      late_entry_grace_minutes: exam.late_entry_grace_minutes,
      show_score_immediately: exam.show_score_immediately,
      auto_submit_enabled: exam.auto_submit_enabled,
      allow_post_exam_review: reviewPolicy.allow_post_exam_review ?? true,
      show_answer_key_in_review: reviewPolicy.show_answer_key_in_review ?? false,
      show_score_in_review: reviewPolicy.show_score_in_review ?? Boolean(exam.show_score_immediately),
      selected_question_ids: exam.question_links.map((item) => item.question.id),
      question_settings: questionSettings,
      faculty_ids: exam.faculty_access.map((item) => item.id),
      selected_student_ids: exam.assigned_students.filter((item) => item.assignment_source === "selected").map((item) => item.id),
      selected_department_codes: exam.settings?.departments || [],
      settingsText: JSON.stringify(extraSettings, null, 2),
    });
    setActiveTab("exams");
  };

  const publishExam = async (examId) => {
    setStatusMessage("");
    setError("");
    try {
      await apiPost(`/portal/exams/${examId}/publish`, {});
      setStatusMessage("Exam published");
      invalidatePortalBootstrap();
      await loadBootstrap();
    } catch (requestError) {
      setError(requestError.message || "Unable to publish exam");
    }
  };

  const renderMcqBuilder = () => (
    <article className="erp-card rounded-[30px] p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-blue-600">MCQ Builder</p>
          <p className="mt-2 text-sm text-slate-600">Add up to 8 options and mark one or more correct answers.</p>
        </div>
        {manualQuestionForm.options.length < 8 && (
          <button type="button" onClick={() => addManualArrayItem("options", createBlankQuestionOption)} className="rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
            Add Option
          </button>
        )}
      </div>
      <div className="mt-5 space-y-3">
        {manualQuestionForm.options.map((option, index) => (
          <div key={option.id || index} className="grid gap-3 md:grid-cols-[auto_1fr_auto]">
            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={manualQuestionForm.correct_answers.includes(option.id)}
                onChange={(event) => {
                  const nextAnswers = event.target.checked
                    ? [...manualQuestionForm.correct_answers, option.id]
                    : manualQuestionForm.correct_answers.filter((item) => item !== option.id);
                  updateManualQuestion("correct_answers", nextAnswers);
                }}
              />
              Correct
            </label>
            <input value={option.label} onChange={(event) => updateManualArrayItem("options", index, { label: event.target.value })} className="rounded-2xl border border-slate-200 px-4 py-3" placeholder={`Option ${index + 1}`} />
            {manualQuestionForm.options.length > 2 && (
              <button type="button" onClick={() => removeManualArrayItem("options", index)} className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600">
                Remove
              </button>
            )}
          </div>
        ))}
      </div>
    </article>
  );

  const renderCodingBuilder = () => (
    <article className="erp-card rounded-[30px] p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.4em] text-blue-600">Coding Setup</p>
      <label className="mt-5 block text-sm font-semibold text-slate-700">Allowed languages</label>
      <div className="mt-3 flex flex-wrap gap-3">
        {languageOptions.map((language) => (
          <label key={language} className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={manualQuestionForm.allowed_languages.includes(language)}
              onChange={(event) => {
                const next = event.target.checked
                  ? [...manualQuestionForm.allowed_languages, language]
                  : manualQuestionForm.allowed_languages.filter((item) => item !== language);
                updateManualQuestion("allowed_languages", next);
              }}
            />
            {language.toUpperCase()}
          </label>
        ))}
      </div>
      <input value={manualQuestionForm.function_signature} onChange={(event) => updateManualQuestion("function_signature", event.target.value)} className="mt-4 w-full rounded-2xl border border-slate-200 px-4 py-3" placeholder="Function signature" />
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {manualQuestionForm.allowed_languages.map((language) => (
          <textarea
            key={language}
            value={manualQuestionForm.starter_code[language] || ""}
            onChange={(event) => updateManualQuestion("starter_code", { ...manualQuestionForm.starter_code, [language]: event.target.value })}
            className="min-h-[160px] rounded-2xl border border-slate-200 px-4 py-3 font-mono text-sm"
            placeholder={`${language.toUpperCase()} starter code`}
          />
        ))}
      </div>
    </article>
  );

  const renderSqlBuilder = () => (
    <article className="erp-card rounded-[30px] p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.4em] text-blue-600">SQL Setup</p>
      <textarea value={manualQuestionForm.expected_output} onChange={(event) => updateManualQuestion("expected_output", event.target.value)} className="mt-5 min-h-[110px] w-full rounded-2xl border border-slate-200 px-4 py-3" placeholder="Expected SQL output snapshot" />
      <textarea value={manualQuestionForm.starter_code.sql} onChange={(event) => updateManualQuestion("starter_code", { ...manualQuestionForm.starter_code, sql: event.target.value })} className="mt-4 min-h-[160px] w-full rounded-2xl border border-slate-200 px-4 py-3 font-mono text-sm" placeholder="SQL starter query" />
      <div className="mt-5 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm font-semibold text-slate-700">SQL sample tables</p>
        <div className="mt-4 grid gap-3">
          <input value={manualQuestionForm.sampleTableDraft.name} onChange={(event) => updateManualQuestion("sampleTableDraft", { ...manualQuestionForm.sampleTableDraft, name: event.target.value })} className="rounded-2xl border border-slate-200 px-4 py-3" placeholder="Table name" />
          <input value={manualQuestionForm.sampleTableDraft.columns} onChange={(event) => updateManualQuestion("sampleTableDraft", { ...manualQuestionForm.sampleTableDraft, columns: event.target.value })} className="rounded-2xl border border-slate-200 px-4 py-3" placeholder="Columns separated by commas" />
          <textarea value={manualQuestionForm.sampleTableDraft.rowsText} onChange={(event) => updateManualQuestion("sampleTableDraft", { ...manualQuestionForm.sampleTableDraft, rowsText: event.target.value })} className="min-h-[120px] rounded-2xl border border-slate-200 px-4 py-3 font-mono text-sm" placeholder='Rows JSON like [["1","Asha","100"]]' />
          <button type="button" onClick={addSampleTable} className="rounded-full border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700">
            Add Sample Table
          </button>
        </div>
        <div className="mt-4 space-y-3">
          {manualQuestionForm.sample_tables.map((table, index) => (
            <div key={`${table.name}-${index}`} className="rounded-2xl bg-white px-4 py-4 text-sm text-slate-700">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900">{table.name}</p>
                  <p className="text-slate-500">{table.columns.join(", ")}</p>
                </div>
                <button type="button" onClick={() => setManualQuestionForm((current) => ({ ...current, sample_tables: current.sample_tables.filter((_, itemIndex) => itemIndex !== index) }))} className="text-sm font-semibold text-rose-600">
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </article>
  );

  return (
    <div className="space-y-6">
      <section className="erp-card rounded-[32px] px-6 py-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.45em] text-blue-600">Advanced Exam Management</p>
            <h1 className="mt-3 text-4xl font-extrabold text-slate-900">Question bank, practice imports, and mixed-format papers</h1>
            <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-600">Build a reusable exam bank, import coding and SQL problems from Practice Arena, create better MCQ questions, and configure mixed-format exams with optional per-question timing.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            {["exams", "questions"].map((tab) => (
              <button key={tab} type="button" onClick={() => setActiveTab(tab)} className={`rounded-full px-5 py-3 text-sm font-semibold ${activeTab === tab ? "bg-[#0F5BD8] text-white" : "border border-blue-100 bg-blue-50 text-blue-700"}`}>
                {tab === "exams" ? "Exam Builder" : "Question Bank"}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Published Exams", value: examStats.publishedExams, hint: "Live or ready exam windows" },
          { label: "Exam Bank", value: examStats.totalExamBank, hint: "Reusable bank questions for exams" },
          { label: "Practice Library", value: examStats.practiceReady, hint: "Practice Arena questions ready to import" },
          { label: "Total Exams", value: examStats.totalExams, hint: "Managed assessment papers" },
        ].map((card) => (
          <article key={card.label} className="erp-card rounded-[26px] p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-600">{card.label}</p>
            <p className="mt-4 text-4xl font-extrabold text-slate-900">{card.value}</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">{card.hint}</p>
          </article>
        ))}
      </section>

      {statusMessage && <div className="rounded-3xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-700">{statusMessage}</div>}
      {error && <div className="rounded-3xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-600">{error}</div>}

      {activeTab === "questions" ? (
        <div className="space-y-6">
          <section className="erp-card rounded-[28px] p-5">
            <div className="flex flex-wrap gap-3">
              {[
                { id: "manual", label: editingQuestionId ? "Edit Question" : "Manual Builder" },
                { id: "import", label: "Import Practice Questions" },
                { id: "library", label: "Exam Question Library" },
              ].map((tab) => (
                <button key={tab.id} type="button" onClick={() => setQuestionBuilderTab(tab.id)} className={`rounded-full px-5 py-3 text-sm font-semibold ${questionBuilderTab === tab.id ? "bg-[#0F5BD8] text-white" : "border border-blue-100 bg-blue-50 text-blue-700"}`}>
                  {tab.label}
                </button>
              ))}
            </div>
          </section>

          {questionBuilderTab === "manual" && (
            <form className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]" onSubmit={handleQuestionSubmit}>
              <section className="space-y-6">
                <article className="erp-card rounded-[30px] p-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.4em] text-blue-600">{editingQuestionId ? "Update Bank Question" : "Create Bank Question"}</p>
                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <input value={manualQuestionForm.title} onChange={(event) => updateManualQuestion("title", event.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3" placeholder="Question title" required />
                    <input value={manualQuestionForm.short_description} onChange={(event) => updateManualQuestion("short_description", event.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3" placeholder="Short description" />
                    <select value={manualQuestionForm.question_type} onChange={(event) => updateManualQuestion("question_type", event.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3">{questionTypes.map((item) => <option key={item} value={item}>{item.toUpperCase()}</option>)}</select>
                    <select value={manualQuestionForm.difficulty} onChange={(event) => updateManualQuestion("difficulty", event.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3">{difficultyOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select>
                    <input type="number" min="1" value={manualQuestionForm.points} onChange={(event) => updateManualQuestion("points", event.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3" placeholder="Points" />
                    <input type="number" min="0" value={manualQuestionForm.question_timer_minutes} onChange={(event) => updateManualQuestion("question_timer_minutes", event.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3" placeholder="Optional timer in minutes" />
                  </div>
                  <input value={manualQuestionForm.tagsInput} onChange={(event) => updateManualQuestion("tagsInput", event.target.value)} className="mt-4 w-full rounded-2xl border border-slate-200 px-4 py-3" placeholder="Tags separated by commas" />
                  <textarea value={manualQuestionForm.prompt} onChange={(event) => updateManualQuestion("prompt", event.target.value)} className="mt-4 min-h-[180px] w-full rounded-2xl border border-slate-200 px-4 py-3" placeholder="Question statement" required />
                  <textarea value={manualQuestionForm.instructions} onChange={(event) => updateManualQuestion("instructions", event.target.value)} className="mt-4 min-h-[100px] w-full rounded-2xl border border-slate-200 px-4 py-3" placeholder="Instructions shown to students" />
                </article>
                <article className="erp-card rounded-[30px] p-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.4em] text-blue-600">Presentation</p>
                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <div className="space-y-3">
                      <input value={manualQuestionForm.image_url} onChange={(event) => updateManualQuestion("image_url", event.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3" placeholder="Image URL" />
                      <label className="inline-flex cursor-pointer items-center rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
                        {uploadingImage ? "Uploading..." : "Upload Image"}
                        <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => uploadQuestionImage(event.target.files?.[0])} />
                      </label>
                    </div>
                    <input value={manualQuestionForm.image_caption} onChange={(event) => updateManualQuestion("image_caption", event.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3" placeholder="Image caption" />
                    <textarea value={manualQuestionForm.input_format} onChange={(event) => updateManualQuestion("input_format", event.target.value)} className="min-h-[110px] rounded-2xl border border-slate-200 px-4 py-3" placeholder="Input format" />
                    <textarea value={manualQuestionForm.output_format} onChange={(event) => updateManualQuestion("output_format", event.target.value)} className="min-h-[110px] rounded-2xl border border-slate-200 px-4 py-3" placeholder="Output format" />
                    <textarea value={manualQuestionForm.constraints} onChange={(event) => updateManualQuestion("constraints", event.target.value)} className="min-h-[110px] rounded-2xl border border-slate-200 px-4 py-3 md:col-span-2" placeholder="Constraints" />
                  </div>
                </article>
                {manualQuestionForm.image_url && (
                  <article className="erp-card rounded-[30px] p-6">
                    <p className="text-xs font-semibold uppercase tracking-[0.4em] text-blue-600">Image Preview</p>
                    <div className="mt-4 overflow-hidden rounded-[24px] border border-slate-200 bg-slate-50">
                      <img src={manualQuestionForm.image_url} alt={manualQuestionForm.image_caption || manualQuestionForm.title} className="max-h-[320px] w-full object-contain bg-white" />
                    </div>
                  </article>
                )}
                {manualQuestionForm.question_type === "mcq" && renderMcqBuilder()}
                {manualQuestionForm.question_type === "coding" && renderCodingBuilder()}
                {manualQuestionForm.question_type === "sql" && renderSqlBuilder()}
              </section>

              <section className="space-y-6">
                <article className="erp-card rounded-[30px] p-6">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.4em] text-blue-600">Examples</p>
                      <p className="mt-2 text-sm text-slate-600">Create examples the way candidates should see them.</p>
                    </div>
                    <button type="button" onClick={() => addManualArrayItem("examples", () => ({ input: "", output: "", explanation: "" }))} className="rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">Add Example</button>
                  </div>
                  <div className="mt-5 space-y-4">
                    {manualQuestionForm.examples.map((example, index) => (
                      <div key={`example-${index}`} className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                        <textarea value={example.input} onChange={(event) => updateManualArrayItem("examples", index, { input: event.target.value })} className="min-h-[90px] w-full rounded-2xl border border-slate-200 px-4 py-3" placeholder="Example input" />
                        <textarea value={example.output} onChange={(event) => updateManualArrayItem("examples", index, { output: event.target.value })} className="mt-3 min-h-[90px] w-full rounded-2xl border border-slate-200 px-4 py-3" placeholder="Example output" />
                        <input value={example.explanation} onChange={(event) => updateManualArrayItem("examples", index, { explanation: event.target.value })} className="mt-3 w-full rounded-2xl border border-slate-200 px-4 py-3" placeholder="Explanation" />
                      </div>
                    ))}
                  </div>
                </article>
                {(manualQuestionForm.question_type === "coding" || manualQuestionForm.question_type === "sql") && (
                  <>
                    <article className="erp-card rounded-[30px] p-6">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.4em] text-blue-600">Visible Test Cases</p>
                        <button type="button" onClick={() => addManualArrayItem("visible_test_cases", () => ({ input: "", output: "" }))} className="rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">Add Visible Case</button>
                      </div>
                      <div className="mt-5 space-y-4">
                        {manualQuestionForm.visible_test_cases.map((item, index) => (
                          <div key={`visible-${index}`} className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                            <textarea value={item.input} onChange={(event) => updateManualArrayItem("visible_test_cases", index, { input: event.target.value })} className="min-h-[90px] w-full rounded-2xl border border-slate-200 px-4 py-3" placeholder="Input" />
                            <textarea value={item.output} onChange={(event) => updateManualArrayItem("visible_test_cases", index, { output: event.target.value })} className="mt-3 min-h-[90px] w-full rounded-2xl border border-slate-200 px-4 py-3" placeholder="Expected output" />
                          </div>
                        ))}
                      </div>
                    </article>
                    <article className="erp-card rounded-[30px] p-6">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.4em] text-blue-600">Hidden Test Cases</p>
                        <button type="button" onClick={() => addManualArrayItem("hidden_test_cases", () => ({ input: "", output: "" }))} className="rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">Add Hidden Case</button>
                      </div>
                      <div className="mt-5 space-y-4">
                        {manualQuestionForm.hidden_test_cases.map((item, index) => (
                          <div key={`hidden-${index}`} className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                            <textarea value={item.input} onChange={(event) => updateManualArrayItem("hidden_test_cases", index, { input: event.target.value })} className="min-h-[90px] w-full rounded-2xl border border-slate-200 px-4 py-3" placeholder="Input" />
                            <textarea value={item.output} onChange={(event) => updateManualArrayItem("hidden_test_cases", index, { output: event.target.value })} className="mt-3 min-h-[90px] w-full rounded-2xl border border-slate-200 px-4 py-3" placeholder="Expected output" />
                          </div>
                        ))}
                      </div>
                    </article>
                  </>
                )}
                <article className="erp-card rounded-[30px] p-6">
                  <div className="flex gap-3">
                    <button type="submit" className="rounded-full bg-[#0F5BD8] px-5 py-3 text-sm font-semibold text-white">{editingQuestionId ? "Update Question" : "Create Question"}</button>
                    {editingQuestionId && <button type="button" onClick={resetQuestionBuilder} className="rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700">Cancel Edit</button>}
                  </div>
                </article>
              </section>
            </form>
          )}

          {questionBuilderTab === "import" && (
            <section className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
              <article className="erp-card rounded-[30px] p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.4em] text-blue-600">Import Strategy</p>
                <h2 className="mt-3 text-2xl font-extrabold text-slate-900">Use Practice Arena as the coding and SQL source</h2>
                <div className="mt-4 space-y-3 text-sm leading-7 text-slate-600">
                  <p>Import your existing coding and SQL questions into the exam bank instead of recreating them.</p>
                  <p>The import keeps starter code, examples, visible and hidden test cases, time limit, and SQL setup.</p>
                </div>
                <div className="mt-5 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">Bulk import from CSV</p>
                  <p className="mt-2 text-sm text-slate-600">Download the template, fill 100+ questions in one sheet, then import them directly into the exam bank.</p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button type="button" onClick={downloadBulkTemplate} className="rounded-full border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700">Download CSV Template</button>
                    <label className="inline-flex cursor-pointer items-center rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
                      {bulkImportFile ? bulkImportFile.name : "Choose CSV File"}
                      <input type="file" accept=".csv,text/csv" className="hidden" onChange={(event) => setBulkImportFile(event.target.files?.[0] || null)} />
                    </label>
                    <button type="button" onClick={bulkImportQuestions} disabled={!bulkImportFile || bulkImporting} className="rounded-full bg-[#0F5BD8] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
                      {bulkImporting ? "Importing..." : "Bulk Import CSV"}
                    </button>
                  </div>
                </div>
                <div className="mt-5 rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">Selected for import: {practiceSelection.length}</div>
                <button type="button" onClick={importSelectedPracticeQuestions} disabled={practiceSelection.length === 0} className="mt-5 rounded-full bg-[#0F5BD8] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">
                  Import Selected Practice Questions
                </button>
              </article>
              <article className="erp-card rounded-[30px] p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.4em] text-blue-600">Practice Question Library</p>
                    <p className="mt-2 text-sm text-slate-600">Search the existing coding and SQL inventory and import what you need.</p>
                  </div>
                  <input value={practiceSearch} onChange={(event) => setPracticeSearch(event.target.value)} className="rounded-full border border-slate-200 px-5 py-3 text-sm" placeholder="Search practice questions" />
                </div>
                <div className="mt-5 space-y-4">
                  {loading ? <div className="rounded-[24px] border border-dashed border-slate-200 px-5 py-10 text-sm text-slate-500">Loading practice bank...</div> : filteredPracticeBank.map((question) => {
                    const selected = practiceSelection.includes(question.id);
                    return (
                      <label key={question.id} className={`block rounded-[24px] border p-5 transition ${selected ? "border-blue-200 bg-blue-50/60" : "border-slate-200 bg-slate-50"}`}>
                        <div className="flex items-start gap-4">
                          <input type="checkbox" checked={selected} onChange={(event) => setPracticeSelection((current) => event.target.checked ? [...current, question.id] : current.filter((item) => item !== question.id))} className="mt-1" />
                          <div className="flex-1">
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                              <div>
                                <p className="text-lg font-bold text-slate-900">{question.title}</p>
                                <p className="mt-2 text-sm text-slate-600">{question.short_description}</p>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <span className="rounded-full border border-teal-100 bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700">{question.category.toUpperCase()}</span>
                                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">{question.points} marks</span>
                                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">{question.time_limit}s</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </article>
            </section>
          )}

          {questionBuilderTab === "library" && (
            <section className="erp-card rounded-[30px] p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.4em] text-blue-600">Exam Question Library</p>
                  <p className="mt-2 text-sm text-slate-600">Search the exam bank, review origins, and edit bank questions.</p>
                </div>
                <input value={questionSearch} onChange={(event) => setQuestionSearch(event.target.value)} className="rounded-full border border-slate-200 px-5 py-3 text-sm" placeholder="Search exam bank" />
              </div>
              <div className="mt-5 space-y-4">
                {loading ? <div className="rounded-[24px] border border-dashed border-slate-200 px-5 py-10 text-sm text-slate-500">Loading question bank...</div> : filteredQuestionBank.map((question) => (
                  <article key={question.id} className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap gap-2">
                          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${sourceTone[question.source_type] || sourceTone.exam_portal}`}>{question.source_type === "practice_arena" ? "Imported from Practice" : "Exam Portal"}</span>
                          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">{question.question_type.toUpperCase()}</span>
                        </div>
                        <p className="mt-3 text-lg font-bold text-slate-900">{question.title}</p>
                        <p className="mt-2 text-sm text-slate-600">{question.short_description || question.instructions || "No summary provided."}</p>
                      </div>
                      <button type="button" onClick={() => startQuestionEdit(question)} className="rounded-full border border-blue-100 bg-white px-4 py-2 text-sm font-semibold text-blue-700">Edit</button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}
        </div>
      ) : (
        <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <form className="erp-card rounded-[30px] p-6" onSubmit={handleExamSubmit}>
            <p className="text-xs font-semibold uppercase tracking-[0.4em] text-blue-600">{editingExamId ? "Edit Exam" : "Create Exam"}</p>
            <div className="mt-4 rounded-[24px] border border-blue-100 bg-blue-50/70 p-4 text-sm leading-7 text-slate-700">Build one paper with mixed MCQ, written, coding, and SQL questions. Each selected question can also carry its own optional timer and section label.</div>
            <div className="mt-5 grid gap-4">
              <input value={examForm.title} onChange={(event) => setExamForm((current) => ({ ...current, title: event.target.value }))} className="rounded-2xl border border-slate-200 px-4 py-3" placeholder="Exam title" required />
              <textarea value={examForm.description} onChange={(event) => setExamForm((current) => ({ ...current, description: event.target.value }))} className="min-h-[90px] rounded-2xl border border-slate-200 px-4 py-3" placeholder="Exam description" />
              <textarea value={examForm.instructions} onChange={(event) => setExamForm((current) => ({ ...current, instructions: event.target.value }))} className="min-h-[120px] rounded-2xl border border-slate-200 px-4 py-3" placeholder="Candidate instructions" />
              <div className="grid gap-4 md:grid-cols-2">
                <input value={examForm.exam_password} onChange={(event) => setExamForm((current) => ({ ...current, exam_password: event.target.value }))} className="rounded-2xl border border-slate-200 px-4 py-3" placeholder={editingExamId ? "Leave blank to keep current password" : "Exam password"} required={!editingExamId} />
                <select value={examForm.status} onChange={(event) => setExamForm((current) => ({ ...current, status: event.target.value }))} className="rounded-2xl border border-slate-200 px-4 py-3">{["draft", "scheduled", "published", "archived"].map((item) => <option key={item} value={item}>{item}</option>)}</select>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <input type="datetime-local" value={examForm.start_time} onChange={(event) => setExamForm((current) => ({ ...current, start_time: event.target.value }))} className="rounded-2xl border border-slate-200 px-4 py-3" />
                <input type="datetime-local" value={examForm.end_time} onChange={(event) => setExamForm((current) => ({ ...current, end_time: event.target.value }))} className="rounded-2xl border border-slate-200 px-4 py-3" />
                <input type="number" min="1" value={examForm.duration_minutes} onChange={(event) => setExamForm((current) => ({ ...current, duration_minutes: event.target.value }))} className="rounded-2xl border border-slate-200 px-4 py-3" placeholder="Exam duration minutes" />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <select value={examForm.access_scope} onChange={(event) => setExamForm((current) => ({ ...current, access_scope: event.target.value }))} className="rounded-2xl border border-slate-200 px-4 py-3">
                  {["department", "selected_students", "hybrid"].map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
                <input type="number" min="0" value={examForm.late_entry_grace_minutes} onChange={(event) => setExamForm((current) => ({ ...current, late_entry_grace_minutes: event.target.value }))} className="rounded-2xl border border-slate-200 px-4 py-3" placeholder="Late entry grace minutes" />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {[
                  ["shuffle_questions", "Shuffle questions"],
                  ["shuffle_mcq_options", "Shuffle MCQ options"],
                  ["allow_late_entry", "Allow late entry"],
                  ["show_score_immediately", "Show score immediately"],
                  ["auto_submit_enabled", "Auto-submit enabled"],
                ].map(([key, label]) => (
                  <label key={key} className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
                    <input type="checkbox" checked={examForm[key]} onChange={(event) => setExamForm((current) => ({ ...current, [key]: event.target.checked }))} />
                    {label}
                  </label>
                ))}
              </div>
              <div className="rounded-[24px] border border-amber-100 bg-gradient-to-br from-amber-50 via-white to-rose-50 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-700">Review Release Controls</p>
                <p className="mt-2 text-sm leading-7 text-slate-600">Decide what students can see after the exam window closes. This helps you run strict exams or practice-friendly exams from the same builder.</p>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <label className="flex items-center gap-3 rounded-2xl border border-white/80 bg-white px-4 py-3 text-sm text-slate-700">
                    <input type="checkbox" checked={examForm.allow_post_exam_review} onChange={(event) => setExamForm((current) => ({ ...current, allow_post_exam_review: event.target.checked }))} />
                    Allow post-exam review
                  </label>
                  <label className="flex items-center gap-3 rounded-2xl border border-white/80 bg-white px-4 py-3 text-sm text-slate-700">
                    <input type="checkbox" checked={examForm.show_answer_key_in_review} onChange={(event) => setExamForm((current) => ({ ...current, show_answer_key_in_review: event.target.checked }))} disabled={!examForm.allow_post_exam_review} />
                    Show answer key in review
                  </label>
                  <label className="flex items-center gap-3 rounded-2xl border border-white/80 bg-white px-4 py-3 text-sm text-slate-700">
                    <input type="checkbox" checked={examForm.show_score_in_review} onChange={(event) => setExamForm((current) => ({ ...current, show_score_in_review: event.target.checked }))} disabled={!examForm.allow_post_exam_review} />
                    Show score in review
                  </label>
                </div>
              </div>
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">Select bank questions for this exam</p>
                <div className="mt-4 max-h-[260px] space-y-3 overflow-auto">
                  {questionBank.map((question) => {
                    const selected = examForm.selected_question_ids.includes(question.id);
                    return (
                      <label key={question.id} className={`block rounded-[22px] border p-4 ${selected ? "border-blue-200 bg-blue-50/60" : "border-slate-200 bg-white"}`}>
                        <div className="flex items-start gap-4">
                          <input type="checkbox" checked={selected} onChange={() => toggleExamQuestion(question.id)} className="mt-1" />
                          <div className="flex-1">
                            <div className="flex flex-wrap gap-2">
                              <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${sourceTone[question.source_type] || sourceTone.exam_portal}`}>{question.source_type === "practice_arena" ? "Practice Import" : "Exam Bank"}</span>
                              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">{question.question_type.toUpperCase()}</span>
                            </div>
                            <p className="mt-3 font-semibold text-slate-900">{question.title}</p>
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
              {selectedExamQuestions.length > 0 && <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4"><p className="text-sm font-semibold text-slate-900">Selected paper blueprint</p><div className="mt-4 space-y-4">{selectedExamQuestions.map((question, index) => { const config = examForm.question_settings[question.id] || {}; return <div key={question.id} className="rounded-[22px] bg-white p-4"><p className="font-semibold text-slate-900">{index + 1}. {question.title}</p><div className="mt-4 grid gap-3 md:grid-cols-4"><input value={config.section_name || ""} onChange={(event) => updateExamQuestionSetting(question.id, { section_name: event.target.value })} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm" placeholder="Section name" /><input type="number" min="1" value={config.points || question.points} onChange={(event) => updateExamQuestionSetting(question.id, { points: event.target.value })} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm" placeholder="Marks" /><input type="number" min="0" value={config.question_duration_minutes || ""} onChange={(event) => updateExamQuestionSetting(question.id, { question_duration_minutes: event.target.value })} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm" placeholder="Optional timer" /><label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700"><input type="checkbox" checked={config.required !== false} onChange={(event) => updateExamQuestionSetting(question.id, { required: event.target.checked })} />Required</label></div></div>; })}</div></div>}
              <label className="space-y-2">
                <span className="text-sm font-semibold text-slate-700">Assign faculty access</span>
                <select multiple value={examForm.faculty_ids.map(String)} onChange={(event) => setExamForm((current) => ({ ...current, faculty_ids: [...event.target.selectedOptions].map((item) => Number(item.value)) }))} className="min-h-[120px] rounded-2xl border border-slate-200 px-4 py-3">
                  {(bootstrap.faculty || []).map((faculty) => <option key={faculty.id} value={faculty.id}>{faculty.name} ({faculty.role})</option>)}
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold text-slate-700">Assign specific students</span>
                <select multiple value={examForm.selected_student_ids.map(String)} onChange={(event) => setExamForm((current) => ({ ...current, selected_student_ids: [...event.target.selectedOptions].map((item) => Number(item.value)) }))} className="min-h-[120px] rounded-2xl border border-slate-200 px-4 py-3">
                  {(bootstrap.students || []).map((student) => <option key={student.id} value={student.id}>{student.identifier} - {student.name}</option>)}
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold text-slate-700">Target departments</span>
                <select multiple value={examForm.selected_department_codes} onChange={(event) => setExamForm((current) => ({ ...current, selected_department_codes: [...event.target.selectedOptions].map((item) => item.value) }))} className="min-h-[120px] rounded-2xl border border-slate-200 px-4 py-3">
                  {(bootstrap.departments || []).map((department) => <option key={department.code} value={department.code}>{department.name}</option>)}
                </select>
              </label>
              <textarea value={examForm.settingsText} onChange={(event) => setExamForm((current) => ({ ...current, settingsText: event.target.value }))} className="min-h-[120px] rounded-2xl border border-slate-200 px-4 py-3 font-mono text-sm" placeholder="Extra exam settings JSON" />
              <div className="flex gap-3">
                <button type="submit" className="rounded-full bg-[#0F5BD8] px-5 py-3 text-sm font-semibold text-white">{editingExamId ? "Update Exam" : "Save Exam"}</button>
                {editingExamId && <button type="button" onClick={() => { setEditingExamId(null); setExamForm(createExamForm()); }} className="rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700">Cancel Edit</button>}
              </div>
            </div>
          </form>
          <section className="erp-card rounded-[30px] p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.4em] text-blue-600">Exam Library</p>
            <div className="mt-5 space-y-4">
              {loading ? <div className="rounded-[24px] border border-dashed border-slate-200 px-5 py-10 text-sm text-slate-500">Loading exams...</div> : exams.map((exam) => (
                <article key={exam.id} className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-lg font-bold text-slate-900">{exam.title}</p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{exam.description}</p>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => startExamEdit(exam)} className="rounded-full border border-blue-100 bg-white px-4 py-2 text-sm font-semibold text-blue-700">Edit</button>
                      {exam.status !== "published" && <button type="button" onClick={() => publishExam(exam.id)} className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">Publish</button>}
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <div className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-700">{exam.status}</div>
                    <div className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-700">{exam.duration_minutes} mins</div>
                    <div className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-700">{exam.total_marks} marks</div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </section>
      )}
    </div>
  );
};

export default ExamManagement;
