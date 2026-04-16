import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Editor from "@monaco-editor/react";
import { API_BASE } from "../utils/api";
import { getStoredUser } from "../utils/roleHelper";
import OneCompilerEmbed from "../components/OneCompilerEmbed";
import northwindSchemaImage from "../assets/northwind-schema.svg";
import hrSchemaImage from "../assets/hr-schema.svg";
import salesmartSchemaImage from "../assets/salesmart-schema.svg";
import { getPlaygroundSettings } from "../utils/playgroundSettings";

const BASE_MODULES = [
  { id: "compiler", label: "Compiler Lab", live: true },
  { id: "app", label: "App Playground", live: true },
  { id: "sql", label: "SQL Playground", live: true },
  { id: "notebook", label: "Notebook Lab", live: true },
];

const SAVE_LIMIT = 5;

const COMPILER_LANGUAGE_OPTIONS = [
  { id: "python", label: "Python" },
  { id: "javascript", label: "JavaScript" },
  { id: "java", label: "Java" },
  { id: "cpp", label: "C++" },
  { id: "c", label: "C" },
  { id: "csharp", label: "C#" },
  { id: "go", label: "Go" },
  { id: "rust", label: "Rust" },
  { id: "typescript", label: "TypeScript" },
  { id: "php", label: "PHP" },
  { id: "ruby", label: "Ruby" },
  { id: "swift", label: "Swift" },
  { id: "kotlin", label: "Kotlin" },
  { id: "r", label: "R" },
  { id: "scala", label: "Scala" },
  { id: "perl", label: "Perl" },
  { id: "lua", label: "Lua" },
  { id: "bash", label: "Bash" },
  { id: "sql", label: "PostgreSQL" },
];

const COMPILER_LIBRARY_BADGES = {
  python: ["pandas", "numpy", "openpyxl", "matplotlib", "seaborn", "plotly", "streamlit"],
  javascript: ["node", "npm", "stdin", "stdout"],
  java: ["stdin", "stdout", "class Main"],
  cpp: ["g++", "stdin", "stdout"],
  sql: ["query", "result", "postgresql"],
};

const COMPILER_FILE_EXTENSIONS = {
  python: ".py",
  javascript: ".js",
  java: ".java",
  cpp: ".cpp",
  c: ".c",
  csharp: ".cs",
  go: ".go",
  rust: ".rs",
  typescript: ".ts",
  php: ".php",
  ruby: ".rb",
  swift: ".swift",
  kotlin: ".kt",
  r: ".r",
  scala: ".scala",
  perl: ".pl",
  lua: ".lua",
  bash: ".sh",
  sql: ".sql",
};

const getDefaultMainFileName = (languageId) => {
  if (languageId === "java") return "Main.java";
  if (languageId === "csharp") return "Program.cs";
  if (languageId === "sql") return "script.sql";
  return `main${COMPILER_FILE_EXTENSIONS[languageId] || ".txt"}`;
};

const APP_TEMPLATES = [
  {
    id: "app-premium-dashboard",
    label: "Premium Dashboard",
    note: "A polished starter dashboard with KPI cards, charts, and a clean layout.",
    code: `import streamlit as st
import pandas as pd

st.set_page_config(page_title="Student Dashboard", layout="wide")
st.title("Premium Student Dashboard")
st.caption("A clean starter dashboard with simple metrics and charts")

df = pd.DataFrame({
    "week": ["W1", "W2", "W3", "W4"],
    "hours": [6, 8, 7, 9],
    "problems_solved": [10, 15, 12, 18],
})

col1, col2, col3 = st.columns(3)
col1.metric("Study Hours", int(df["hours"].sum()))
col2.metric("Solved", int(df["problems_solved"].sum()))
col3.metric("Best Week", df.loc[df["problems_solved"].idxmax(), "week"])

left, right = st.columns([1.2, 1])
with left:
    st.subheader("Weekly Progress")
    st.line_chart(df.set_index("week")[["hours", "problems_solved"]])
with right:
    st.subheader("Progress Table")
    st.dataframe(df, use_container_width=True)`,
  },
  {
    id: "app-calculator",
    label: "Calculator",
    note: "A simple beginner-friendly calculator app.",
    code: `import streamlit as st

st.set_page_config(page_title="Calculator", layout="centered")
st.title("Simple Calculator")

num1 = st.number_input("First number", value=0.0)
num2 = st.number_input("Second number", value=0.0)
operation = st.selectbox("Choose operation", ["Add", "Subtract", "Multiply", "Divide"])

if st.button("Calculate"):
    if operation == "Add":
        result = num1 + num2
    elif operation == "Subtract":
        result = num1 - num2
    elif operation == "Multiply":
        result = num1 * num2
    else:
        result = "Cannot divide by zero" if num2 == 0 else num1 / num2

    st.success(f"Result: {result}")`,
  },
  {
    id: "app-todo",
    label: "To-Do App",
    note: "An easy task manager example with session state.",
    code: `import streamlit as st

st.title("To-Do App")

if "tasks" not in st.session_state:
    st.session_state.tasks = []

task = st.text_input("New task")
if st.button("Add Task") and task.strip():
    st.session_state.tasks.append(task.strip())

st.subheader("Your Tasks")
if not st.session_state.tasks:
    st.info("No tasks added yet.")
else:
    for index, item in enumerate(st.session_state.tasks, start=1):
        st.write(f"{index}. {item}")`,
  },
  {
    id: "app-quiz",
    label: "Quiz App",
    note: "A small MCQ-style app for beginner interaction.",
    code: `import streamlit as st

st.title("Mini Quiz App")

question = "Which language is commonly used for data analysis?"
answer = st.radio(question, ["HTML", "Python", "CSS", "XML"])

if st.button("Check Answer"):
    if answer == "Python":
        st.success("Correct! Python is widely used for data analysis.")
    else:
        st.error("Not quite. Try again!")`,
  },
  {
    id: "app-unit-converter",
    label: "Unit Converter",
    note: "A beginner project for converting values with simple logic.",
    code: `import streamlit as st

st.title("Unit Converter")

value = st.number_input("Enter value", value=1.0)
conversion = st.selectbox("Conversion type", ["Kilometers to Miles", "Celsius to Fahrenheit", "Kilograms to Pounds"])

if st.button("Convert"):
    if conversion == "Kilometers to Miles":
        result = value * 0.621371
        st.success(f"{value} km = {result:.2f} miles")
    elif conversion == "Celsius to Fahrenheit":
        result = (value * 9/5) + 32
        st.success(f"{value}Â°C = {result:.2f}Â°F")
    else:
        result = value * 2.20462
        st.success(f"{value} kg = {result:.2f} lbs")`,
  },
  {
    id: "app-markdown-notes",
    label: "Notes Preview",
    note: "A simple markdown preview app to help students understand live rendering.",
    code: `import streamlit as st

st.title("Markdown Notes Preview")

text = st.text_area("Write your notes in markdown", value="# Hello\\n\\n- Write notes\\n- Preview instantly")

st.subheader("Preview")
st.markdown(text)`,
  },
  {
    id: "app-data-explorer",
    label: "Data Explorer",
    note: "Upload CSV or Excel and inspect the dataframe with filters.",
    code: `import streamlit as st
import pandas as pd

st.title("Data Explorer")
file = st.file_uploader("Upload CSV or Excel", type=["csv", "xlsx", "xls"])

if file is not None:
    df = pd.read_csv(file) if file.name.endswith(".csv") else pd.read_excel(file)
    st.success("Dataset loaded")
    st.write("Rows:", len(df), "Columns:", len(df.columns))
    st.dataframe(df, use_container_width=True)

    numeric_cols = list(df.select_dtypes(include="number").columns)
    if numeric_cols:
        col = st.selectbox("Numeric column", numeric_cols)
        st.bar_chart(df[col])
else:
    st.info("Upload a dataset to begin exploring.")`,
  },
  {
    id: "app-grade-analyzer",
    label: "Grade Analyzer",
    note: "A small app for analyzing marks and averages.",
    code: `import streamlit as st
import pandas as pd

st.title("Grade Analyzer")

df = pd.DataFrame({
    "student": ["Asha", "Ravi", "Mina", "Kiran"],
    "math": [88, 72, 91, 84],
    "science": [90, 75, 95, 79],
})

df["average"] = df[["math", "science"]].mean(axis=1)
st.dataframe(df, use_container_width=True)
st.bar_chart(df.set_index("student")["average"])`,
  },
  {
    id: "app-habit-tracker",
    label: "Habit Tracker",
    note: "A simple visual tracker for daily habits.",
    code: `import streamlit as st
import pandas as pd

st.title("Habit Tracker")

data = pd.DataFrame({
    "day": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    "study": [1, 1, 0, 1, 1, 0, 1],
    "exercise": [1, 0, 1, 1, 0, 1, 1],
})

st.dataframe(data, use_container_width=True)
st.area_chart(data.set_index("day"))`,
  },
];

const DEFAULT_CAPABILITIES = {
  python_modules: ["pandas", "numpy", "openpyxl", "matplotlib", "streamlit"],
  uploads_supported: true,
  streamlit_supported: true,
};

const DEFAULT_SQL_QUERY = "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;";
const DEFAULT_NOTEBOOK_CELLS = [
  {
    id: "cell-1",
    type: "code",
    code: "",
    output: "",
    status: "idle",
    meta: "",
  },
];

const getNotebookEditorHeight = (code = "") => {
  const lines = Math.max(2, String(code || "").split("\n").length);
  const pixels = 24 + lines * 22;
  return `${Math.min(420, Math.max(68, pixels))}px`;
};

const SQL_SCHEMA_IMAGES = {
  northwind: northwindSchemaImage,
  hr: hrSchemaImage,
  sales_mart: salesmartSchemaImage,
};

const SQL_PAGE_SIZE = 100;

const createSqlTab = (index = 1, query = DEFAULT_SQL_QUERY) => ({
  id: `sql-tab-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  name: `Query ${index}`,
  query,
});

const splitSqlStatements = (source = "") => {
  const text = String(source || "");
  const bySemicolon = text
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);
  if (bySemicolon.length > 1) return bySemicolon;
  return text
    .split(/\n(?=\s*(select|with|explain)\b)/i)
    .map((part) => part.trim())
    .filter(Boolean);
};
const INITIAL_SQL_TAB = createSqlTab(1, DEFAULT_SQL_QUERY);

const buildSqlHistoryKey = (userId, datasetId) => `playground_sql_history_${userId}_${datasetId}`;

const formatSavedAt = (value) => {
  if (!value) return "Saved just now";
  const millis = Number(value) * 1000;
  const date = Number.isFinite(millis) ? new Date(millis) : new Date(value);
  return Number.isNaN(date.getTime()) ? "Saved just now" : date.toLocaleString();
};

const Playground = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentUser = getStoredUser();
  const currentUserId = currentUser?.id || 1;
  const [playgroundSettings, setPlaygroundSettings] = useState(() => getPlaygroundSettings());
  const requestedModule = searchParams.get("module");
  const [activeModule, setActiveModule] = useState(() => (BASE_MODULES.some((module) => module.id === requestedModule) ? requestedModule : "compiler"));
  const [capabilities, setCapabilities] = useState(DEFAULT_CAPABILITIES);
  const [language, setLanguage] = useState("python");
  const [compilerFiles, setCompilerFiles] = useState([{ name: "main.py", content: "" }]);
  const [activeCompilerFile, setActiveCompilerFile] = useState("main.py");
  const [compilerSyncVersion, setCompilerSyncVersion] = useState(1);
  const [status, setStatus] = useState("Synced");
  const [localRunStatus, setLocalRunStatus] = useState("idle");
  const [localRunOutput, setLocalRunOutput] = useState("(no local run yet)");
  const [localRunMeta, setLocalRunMeta] = useState("");
  const [localRunInput, setLocalRunInput] = useState("");
  const [compilerSaveName, setCompilerSaveName] = useState("");
  const [compilerSaves, setCompilerSaves] = useState([]);
  const [compilerSaveSearch, setCompilerSaveSearch] = useState("");
  const [oneCompilerStatus, setOneCompilerStatus] = useState({ configured: false, message: "Checking..." });

  const [appTemplateId, setAppTemplateId] = useState(APP_TEMPLATES[0].id);
  const [appCode, setAppCode] = useState(APP_TEMPLATES[0].code);
  const [appFiles, setAppFiles] = useState([]);
  const [appStatus, setAppStatus] = useState("stopped");
  const [appUrl, setAppUrl] = useState("");
  const [appMessage, setAppMessage] = useState("Launch a Streamlit app and preview it here.");
  const [appLaunching, setAppLaunching] = useState(false);
  const [appSaveName, setAppSaveName] = useState("");
  const [appSaves, setAppSaves] = useState([]);

  const [sqlDatasets, setSqlDatasets] = useState([]);
  const [sqlDatasetId, setSqlDatasetId] = useState("hr");
  const [sqlTabs, setSqlTabs] = useState(() => [INITIAL_SQL_TAB]);
  const [activeSqlTabId, setActiveSqlTabId] = useState(() => INITIAL_SQL_TAB.id);
  const [sqlOutput, setSqlOutput] = useState("(no output yet)");
  const [sqlResultColumns, setSqlResultColumns] = useState([]);
  const [sqlResultRows, setSqlResultRows] = useState([]);
  const [sqlBatchResults, setSqlBatchResults] = useState([]);
  const [sqlMeta, setSqlMeta] = useState("");
  const [sqlRunning, setSqlRunning] = useState(false);
  const [sqlRowOffset, setSqlRowOffset] = useState(0);
  const [sqlRowLimit, setSqlRowLimit] = useState(() => getPlaygroundSettings().sqlPageSize || SQL_PAGE_SIZE);
  const [sqlTotalRows, setSqlTotalRows] = useState(0);
  const [sqlJumpPage, setSqlJumpPage] = useState("");
  const [sqlSaveName, setSqlSaveName] = useState("");
  const [sqlSaves, setSqlSaves] = useState([]);
  const [sqlSaveSearch, setSqlSaveSearch] = useState("");
  const [sqlHistory, setSqlHistory] = useState([]);
  const [northwindStatus, setNorthwindStatus] = useState(null);
  const sqlEditorRef = useRef(null);

  const [notebookLanguage, setNotebookLanguage] = useState("python");
  const [notebookCells, setNotebookCells] = useState(DEFAULT_NOTEBOOK_CELLS);
  const [notebookSaveName, setNotebookSaveName] = useState("");
  const [notebookSaves, setNotebookSaves] = useState([]);
  const [notebookSaveSearch, setNotebookSaveSearch] = useState("");

  useEffect(() => {
    fetch(`${API_BASE}/playground/capabilities`).then((r) => (r.ok ? r.json() : null)).then((data) => data && setCapabilities(data)).catch(() => {});
    fetch(`${API_BASE}/playground/sql/datasets`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const datasets = data?.datasets || [];
        setSqlDatasets(datasets);
        if (datasets.length > 0 && !datasets.some((item) => item.id === sqlDatasetId)) {
          setSqlDatasetId(datasets[0].id);
        }
      })
      .catch(() => setSqlDatasets([]));
    fetch(`${API_BASE}/playground/onecompiler/status`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data && setOneCompilerStatus(data))
      .catch(() => setOneCompilerStatus({ configured: false, message: "Status unavailable." }));
  }, []);

  useEffect(() => {
    const syncSettings = () => setPlaygroundSettings(getPlaygroundSettings());
    window.addEventListener("playground-settings-updated", syncSettings);
    return () => window.removeEventListener("playground-settings-updated", syncSettings);
  }, []);

  useEffect(() => {
    const loadBackendSaves = async () => {
      try {
        const [compilerResponse, appResponse, sqlResponse, notebookResponse] = await Promise.all([
          fetch(`${API_BASE}/playground/saves?user_id=${currentUserId}&module=compiler`),
          fetch(`${API_BASE}/playground/saves?user_id=${currentUserId}&module=app`),
          fetch(`${API_BASE}/playground/saves?user_id=${currentUserId}&module=sql`),
          fetch(`${API_BASE}/playground/saves?user_id=${currentUserId}&module=notebook`),
        ]);
        const [compilerPayload, appPayload, sqlPayload, notebookPayload] = await Promise.all([
          compilerResponse.ok ? compilerResponse.json() : [],
          appResponse.ok ? appResponse.json() : [],
          sqlResponse.ok ? sqlResponse.json() : [],
          notebookResponse.ok ? notebookResponse.json() : [],
        ]);
        setCompilerSaves(Array.isArray(compilerPayload) ? compilerPayload : []);
        setAppSaves(Array.isArray(appPayload) ? appPayload : []);
        setSqlSaves(Array.isArray(sqlPayload) ? sqlPayload : []);
        setNotebookSaves(Array.isArray(notebookPayload) ? notebookPayload : []);
      } catch {
        setCompilerSaves([]);
        setAppSaves([]);
        setSqlSaves([]);
        setNotebookSaves([]);
      }
    };
    loadBackendSaves();
  }, [currentUserId]);

  useEffect(() => {
    if (activeModule !== "app") return undefined;
    const pull = async () => {
      try {
        const response = await fetch(`${API_BASE}/playground/streamlit/status`);
        if (!response.ok) return;
        const payload = await response.json();
        setAppStatus(payload.status);
        setAppUrl(payload.url || "");
        setAppMessage(payload.message || "");
      } catch {}
    };
    pull();
    const timer = window.setInterval(pull, 4000);
    return () => window.clearInterval(timer);
  }, [activeModule]);

  useEffect(() => {
    if (activeModule !== "sql" || sqlDatasetId !== "northwind") return;
    fetch(`${API_BASE}/playground/sql/northwind/status`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setNorthwindStatus(data))
      .catch(() => setNorthwindStatus(null));
  }, [activeModule, sqlDatasetId]);

  useEffect(() => {
    const key = buildSqlHistoryKey(currentUserId, sqlDatasetId);
    try {
      const raw = window.localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : [];
      setSqlHistory(Array.isArray(parsed) ? parsed : []);
    } catch {
      setSqlHistory([]);
    }
    setSqlRowOffset(0);
    setSqlResultColumns([]);
    setSqlResultRows([]);
    setSqlTotalRows(0);
    setSqlMeta("");
    setSqlJumpPage("");
  }, [currentUserId, sqlDatasetId]);

  useEffect(() => {
    const configured = Number(playgroundSettings.sqlPageSize || SQL_PAGE_SIZE);
    const capped = Math.min(Number(capabilities?.sql_max_row_limit || 500), Math.max(50, configured));
    setSqlRowLimit(capped);
  }, [capabilities?.sql_max_row_limit, playgroundSettings.sqlPageSize]);

  const previousNotebookLanguageRef = useRef(notebookLanguage);
  useEffect(() => {
    const previous = previousNotebookLanguageRef.current;
    if (previous !== notebookLanguage && !playgroundSettings.keepNotebookOutputsOnLanguageSwitch) {
      setNotebookCells((prev) => prev.map((cell) => ({ ...cell, output: "", meta: "", status: "idle" })));
    }
    previousNotebookLanguageRef.current = notebookLanguage;
  }, [notebookLanguage, playgroundSettings.keepNotebookOutputsOnLanguageSwitch]);

  const currentAppTemplate = APP_TEMPLATES.find((item) => item.id === appTemplateId) || APP_TEMPLATES[0];
  const compilerBadges = COMPILER_LIBRARY_BADGES[language] || ["stdin", "stdout"];
  const activeCompilerContent = useMemo(() => {
    const activeFile = compilerFiles.find((item) => item.name === activeCompilerFile);
    return activeFile?.content || "";
  }, [activeCompilerFile, compilerFiles]);
  const filteredCompilerSaves = useMemo(() => {
    const query = compilerSaveSearch.trim().toLowerCase();
    if (!query) {
      return compilerSaves;
    }
    return compilerSaves.filter((item) => {
      const haystack = `${item.name || ""} ${item.language || ""}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [compilerSaveSearch, compilerSaves]);

  const filteredSqlSaves = useMemo(() => {
    const query = sqlSaveSearch.trim().toLowerCase();
    if (!query) return sqlSaves;
    return sqlSaves.filter((item) => `${item.name || ""} ${item.language || ""}`.toLowerCase().includes(query));
  }, [sqlSaveSearch, sqlSaves]);

  const filteredNotebookSaves = useMemo(() => {
    const query = notebookSaveSearch.trim().toLowerCase();
    if (!query) return notebookSaves;
    return notebookSaves.filter((item) => `${item.name || ""} ${item.language || ""}`.toLowerCase().includes(query));
  }, [notebookSaveSearch, notebookSaves]);

  const modules = useMemo(
    () =>
      BASE_MODULES.filter((module) => {
        if (module.id === "compiler") return playgroundSettings.compilerEnabled;
        if (module.id === "app") return playgroundSettings.appEnabled;
        if (module.id === "sql") return playgroundSettings.sqlEnabled;
        if (module.id === "notebook") return playgroundSettings.notebookEnabled;
        return true;
      }),
    [playgroundSettings]
  );

  const effectiveSaveLimit = Math.max(1, Number(capabilities?.save_limit || SAVE_LIMIT));

  const activeSqlDataset = useMemo(
    () => sqlDatasets.find((item) => item.id === sqlDatasetId) || sqlDatasets[0] || null,
    [sqlDatasetId, sqlDatasets]
  );
  const activeSqlTab = useMemo(
    () => sqlTabs.find((tab) => tab.id === activeSqlTabId) || sqlTabs[0] || null,
    [activeSqlTabId, sqlTabs]
  );
  const sqlQuery = activeSqlTab?.query || "";
  const activeSqlDatasetRowCount = useMemo(
    () => (activeSqlDataset?.tables || []).reduce((sum, table) => sum + Number(table?.row_count || 0), 0),
    [activeSqlDataset]
  );
  const sqlPageLabel = useMemo(() => {
    if (!sqlTotalRows) return "No rows";
    const start = sqlRowOffset + 1;
    const end = Math.min(sqlRowOffset + sqlResultRows.length, sqlTotalRows);
    return `${start}-${end} of ${sqlTotalRows}`;
  }, [sqlResultRows.length, sqlRowOffset, sqlTotalRows]);
  const sqlTotalPages = useMemo(
    () => (sqlTotalRows > 0 ? Math.max(1, Math.ceil(sqlTotalRows / sqlRowLimit)) : 0),
    [sqlRowLimit, sqlTotalRows]
  );
  const sqlCurrentPage = useMemo(
    () => (sqlTotalRows > 0 ? Math.floor(sqlRowOffset / sqlRowLimit) + 1 : 0),
    [sqlRowLimit, sqlRowOffset, sqlTotalRows]
  );

  useEffect(() => {
    const nextRequestedModule = searchParams.get("module");
    if (nextRequestedModule && BASE_MODULES.some((module) => module.id === nextRequestedModule) && nextRequestedModule !== activeModule) {
      setActiveModule(nextRequestedModule);
    }
  }, [activeModule, searchParams]);

  useEffect(() => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set("module", activeModule);
      return next;
    }, { replace: true });
  }, [activeModule, setSearchParams]);

  useEffect(() => {
    if (modules.some((module) => module.id === activeModule)) return;
    if (modules.length > 0) {
      setActiveModule(modules[0].id);
    }
  }, [activeModule, modules]);

  const changeCompilerLanguage = (nextLanguage) => {
    const mainFileName = getDefaultMainFileName(nextLanguage);
    setLanguage(nextLanguage);
    setCompilerFiles([{ name: mainFileName, content: "" }]);
    setActiveCompilerFile(mainFileName);
    setCompilerSyncVersion((prev) => prev + 1);
    setStatus("Language changed");
  };

  const setActiveCompilerTab = (fileName) => {
    const current = compilerFiles.find((item) => item.name === fileName);
    if (!current) {
      return;
    }
    const reordered = [current, ...compilerFiles.filter((item) => item.name !== fileName)];
    setCompilerFiles(reordered);
    setActiveCompilerFile(fileName);
    setStatus("Tab active");
  };

  const launchApp = async () => {
    setAppLaunching(true);
    setAppMessage("Launching app playground...");
    try {
      const data = new FormData();
      data.append("code", appCode);
      appFiles.forEach((file) => data.append("files", file));
      const response = await fetch(`${API_BASE}/playground/streamlit/start`, { method: "POST", body: data });
      const payload = await response.json();
      setAppStatus(payload.status);
      setAppUrl(payload.url || "");
      setAppMessage(payload.message || "");
    } catch {
      setAppMessage("Unable to launch the Streamlit playground right now.");
    } finally {
      setAppLaunching(false);
    }
  };

  const stopApp = async () => {
    try {
      const response = await fetch(`${API_BASE}/playground/streamlit/stop`, { method: "POST" });
      const payload = await response.json();
      setAppStatus(payload.status);
      setAppUrl("");
      setAppMessage(payload.message || "Streamlit playground stopped.");
    } catch {
      setAppMessage("Unable to stop the Streamlit playground cleanly.");
    }
  };

  const addCompilerFile = () => {
    const extension = COMPILER_FILE_EXTENSIONS[language] || ".txt";
    let index = compilerFiles.length + 1;
    let candidate = `file${index}${extension}`;
    while (compilerFiles.some((item) => item.name === candidate)) {
      index += 1;
      candidate = `file${index}${extension}`;
    }
    const nextFiles = [...compilerFiles, { name: candidate, content: "" }];
    setCompilerFiles(nextFiles);
    setActiveCompilerFile(candidate);
    setCompilerSyncVersion((prev) => prev + 1);
    setStatus("File added");
  };

  const removeCompilerFile = (fileName) => {
    if (compilerFiles.length <= 1) {
      return;
    }
    const nextFiles = compilerFiles.filter((item) => item.name !== fileName);
    setCompilerFiles(nextFiles);
    if (activeCompilerFile === fileName) {
      setActiveCompilerFile(nextFiles[0].name);
    }
    setCompilerSyncVersion((prev) => prev + 1);
    setStatus("File removed");
  };

  const runCompilerLocal = async () => {
    setLocalRunStatus("running");
    setLocalRunMeta("");
    try {
      const response = await fetch(`${API_BASE}/playground/runtime/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language,
          stdin: localRunInput,
          files: compilerFiles,
        }),
      });
      const payload = await response.json();
      const merged = [payload.output, payload.errors].filter(Boolean).join("\n").trim();
      setLocalRunOutput(merged || "(no output)");
      setLocalRunMeta(
        payload.execution_time_ms
          ? `${Number(payload.execution_time_ms).toFixed(1)} ms`
          : ""
      );
      setLocalRunStatus(payload.status === "success" ? "done" : "failed");
    } catch {
      setLocalRunOutput("Local runtime is unavailable right now.");
      setLocalRunMeta("");
      setLocalRunStatus("failed");
    }
  };

  const setSqlQueryForActiveTab = (nextQuery) => {
    setSqlTabs((prev) =>
      prev.map((tab) => (tab.id === activeSqlTabId ? { ...tab, query: nextQuery } : tab))
    );
  };

  const addSqlTab = () => {
    setSqlTabs((prev) => {
      if (prev.length >= 10) return prev;
      const nextTab = createSqlTab(prev.length + 1, "");
      setActiveSqlTabId(nextTab.id);
      return [...prev, nextTab];
    });
  };

  const closeSqlTab = (tabId) => {
    setSqlTabs((prev) => {
      if (prev.length <= 1) return prev;
      const nextTabs = prev.filter((tab) => tab.id !== tabId);
      if (!nextTabs.some((tab) => tab.id === activeSqlTabId)) {
        setActiveSqlTabId(nextTabs[nextTabs.length - 1].id);
      }
      return nextTabs;
    });
  };

  const renameSqlTab = (tabId, nextName) => {
    const cleaned = (nextName || "").trim();
    if (!cleaned) return;
    setSqlTabs((prev) => prev.map((tab) => (tab.id === tabId ? { ...tab, name: cleaned.slice(0, 24) } : tab)));
  };

  const resolveSqlRunPayload = () => {
    const editor = sqlEditorRef.current;
    if (!editor) {
      return { query: sqlQuery.trim(), source: "tab" };
    }
    const model = editor.getModel();
    const selection = editor.getSelection();
    const selected = selection && model ? model.getValueInRange(selection).trim() : "";
    if (selected) {
      return { query: selected, source: "selected" };
    }

    if (model) {
      const content = model.getValue();
      const statements = splitSqlStatements(content);
      if (statements.length > 1) {
        if (content.includes(";")) {
          const position = editor.getPosition();
          const cursorOffset = position ? model.getOffsetAt(position) : 0;
          let start = content.lastIndexOf(";", Math.max(0, cursorOffset - 1));
          let end = content.indexOf(";", cursorOffset);
          if (start === -1) start = 0;
          else start += 1;
          if (end === -1) end = content.length;
          const statement = content.slice(start, end).trim();
          if (statement) {
            return { query: statement, source: "current" };
          }
        }
        return { query: statements[statements.length - 1], source: "current" };
      }
    }
    return { query: sqlQuery.trim(), source: "tab" };
  };

  const executeSqlStatement = async (queryText, offset = 0) => {
    const response = await fetch(`${API_BASE}/playground/sql/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dataset_id: sqlDatasetId,
        query: queryText,
        row_limit: sqlRowLimit,
        row_offset: offset,
      }),
    });
    const payload = await response.json();
    if (!response.ok || payload.status === "error") {
      throw new Error(payload.errors || payload.detail || "SQL execution failed.");
    }
    return payload;
  };

  const executeSqlBatch = async (queryText) => {
    const statements = splitSqlStatements(queryText);
    if (statements.length === 0) {
      throw new Error("Please write a SQL query first.");
    }

    const results = [];
    let totalTime = 0;
    for (let index = 0; index < statements.length; index += 1) {
      // eslint-disable-next-line no-await-in-loop
      const payload = await executeSqlStatement(statements[index], 0);
      totalTime += Number(payload.execution_time_ms || 0);
      results.push({
        id: `${Date.now()}-${index}`,
        query: statements[index],
        columns: Array.isArray(payload.columns) ? payload.columns : [],
        rows: Array.isArray(payload.rows) ? payload.rows : [],
        rowCount: Number(payload.row_count || 0),
        executionTimeMs: Number(payload.execution_time_ms || 0),
        output: payload.output || "(no output)",
      });
    }
    return { results, totalTime };
  };

  const runSqlQuery = async (offset = 0) => {
    setSqlRunning(true);
    setSqlMeta("");
    try {
      const { query: queryToRun, source } = resolveSqlRunPayload();
      let historyRowCount = 0;
      let historyExecutionMs = 0;
      if (!queryToRun) {
        setSqlOutput("Please write a SQL query first.");
        setSqlResultColumns([]);
        setSqlResultRows([]);
        setSqlBatchResults([]);
        setSqlTotalRows(0);
        setSqlRowOffset(0);
        setSqlMeta("");
        return;
      }
      const statements = splitSqlStatements(queryToRun);
      if (statements.length > 1) {
        const { results, totalTime } = await executeSqlBatch(queryToRun);
        setSqlBatchResults(results);
        setSqlResultColumns([]);
        setSqlResultRows([]);
        setSqlRowOffset(0);
        setSqlTotalRows(0);
        setSqlOutput("Batch query run completed.");
        setSqlMeta(`${totalTime.toFixed(1)} ms | ${results.length} result sets`);
        historyRowCount = results.reduce((sum, item) => sum + Number(item.rowCount || 0), 0);
        historyExecutionMs = totalTime;
      } else {
        const payload = await executeSqlStatement(queryToRun, offset);
        setSqlBatchResults([]);
        setSqlOutput(payload.output || "(no output)");
        setSqlResultColumns(Array.isArray(payload.columns) ? payload.columns : []);
        setSqlResultRows(Array.isArray(payload.rows) ? payload.rows : []);
        setSqlRowOffset(Number(payload.row_offset || 0));
        setSqlTotalRows(Number(payload.row_count || 0));
        const rowInfo = payload.truncated ? `${payload.row_count}+ rows` : `${payload.row_count} rows`;
        const sourceLabel = source === "selected" ? "Selected query" : source === "current" ? "Current query" : "Tab query";
        setSqlMeta(`${Number(payload.execution_time_ms || 0).toFixed(1)} ms | ${rowInfo} | ${sourceLabel}`);
        historyRowCount = Number(payload.row_count || 0);
        historyExecutionMs = Number(payload.execution_time_ms || 0);
      }

      if (playgroundSettings.enableSqlHistory) {
        const historyKey = buildSqlHistoryKey(currentUserId, sqlDatasetId);
        const entry = {
          id: `${Date.now()}`,
          query: queryToRun,
          row_count: historyRowCount,
          execution_time_ms: historyExecutionMs,
          created_at: Date.now(),
        };
        setSqlHistory((prev) => {
          const nextHistory = [entry, ...prev.filter((item) => item.query !== queryToRun)].slice(0, 10);
          window.localStorage.setItem(historyKey, JSON.stringify(nextHistory));
          return nextHistory;
        });
      }
    } catch (error) {
      setSqlOutput(error.message || "SQL playground is unavailable right now.");
      setSqlResultColumns([]);
      setSqlResultRows([]);
      setSqlBatchResults([]);
      setSqlTotalRows(0);
      setSqlRowOffset(0);
      setSqlMeta("");
    } finally {
      setSqlRunning(false);
    }
  };

  const runAllSqlQueries = async () => {
    setSqlRunning(true);
    setSqlMeta("");
    try {
      const { results, totalTime } = await executeSqlBatch(sqlQuery);
      setSqlBatchResults(results);
      setSqlResultColumns([]);
      setSqlResultRows([]);
      setSqlRowOffset(0);
      setSqlTotalRows(0);
      setSqlOutput("Batch query run completed.");
      setSqlMeta(`${totalTime.toFixed(1)} ms total | ${results.length} result sets`);
    } catch (error) {
      setSqlOutput(error.message || "Unable to run all queries.");
      setSqlResultColumns([]);
      setSqlResultRows([]);
      setSqlBatchResults([]);
      setSqlTotalRows(0);
      setSqlRowOffset(0);
      setSqlMeta("");
    } finally {
      setSqlRunning(false);
    }
  };

  const previousSqlDatasetRef = useRef(sqlDatasetId);
  useEffect(() => {
    if (previousSqlDatasetRef.current !== sqlDatasetId) {
      if (playgroundSettings.autoRunLastSqlOnDatasetChange && sqlQuery.trim()) {
        runSqlQuery(0);
      }
      previousSqlDatasetRef.current = sqlDatasetId;
    }
  }, [playgroundSettings.autoRunLastSqlOnDatasetChange, sqlDatasetId]);

  const exportSqlResultsCsv = () => {
    if (sqlResultColumns.length === 0 || sqlResultRows.length === 0) {
      return;
    }
    const escapeCsv = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const lines = [
      sqlResultColumns.map((column) => escapeCsv(column)).join(","),
      ...sqlResultRows.map((row) => sqlResultColumns.map((column) => escapeCsv(row?.[column])).join(",")),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${sqlDatasetId}_query_results.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const runAllNotebookCells = async () => {
    for (let index = 0; index < notebookCells.length; index += 1) {
      if (notebookCells[index]?.type === "text") {
        // eslint-disable-next-line no-continue
        continue;
      }
      // eslint-disable-next-line no-await-in-loop
      await runNotebookCell(index);
    }
  };

  const goToSqlPage = (pageNumber) => {
    if (!sqlTotalPages) return;
    const safePage = Math.min(Math.max(1, pageNumber), sqlTotalPages);
    const offset = (safePage - 1) * sqlRowLimit;
    runSqlQuery(offset);
  };

  const clearSqlHistory = () => {
    const key = buildSqlHistoryKey(currentUserId, sqlDatasetId);
    setSqlHistory([]);
    window.localStorage.removeItem(key);
  };

  const addNotebookCell = (type = "code", afterCellId = null) => {
    if (notebookCells.length >= Number(playgroundSettings.maxNotebookCells || 20)) {
      window.alert(`Maximum ${playgroundSettings.maxNotebookCells} notebook cells allowed.`);
      return;
    }
    setNotebookCells((prev) => {
      const nextCell = { id: `cell-${Date.now()}`, type, code: "", output: "", status: "idle", meta: "" };
      if (!afterCellId) return [...prev, nextCell];
      const index = prev.findIndex((cell) => cell.id === afterCellId);
      if (index === -1) return [...prev, nextCell];
      return [...prev.slice(0, index + 1), nextCell, ...prev.slice(index + 1)];
    });
  };

  const removeNotebookCell = (cellId) => {
    setNotebookCells((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((cell) => cell.id !== cellId);
    });
  };

  const updateNotebookCell = (cellId, nextCode) => {
    setNotebookCells((prev) =>
      prev.map((cell) => (cell.id === cellId ? { ...cell, code: nextCode || "", status: "idle" } : cell))
    );
  };

  const runNotebookCell = async (index) => {
    if (notebookCells[index]?.type === "text") return;
    setNotebookCells((prev) =>
      prev.map((cell, cellIndex) =>
        cellIndex === index ? { ...cell, status: "running", meta: "Running..." } : cell
      )
    );
    try {
      const response = await fetch(`${API_BASE}/playground/notebook/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language: notebookLanguage,
          cells: notebookCells.map((cell) => cell.code),
          run_index: index,
        }),
      });
      const payload = await response.json();
      const output = [payload.output, payload.errors].filter(Boolean).join("\n").trim() || "(no output)";
      setNotebookCells((prev) =>
        prev.map((cell, cellIndex) =>
          cellIndex === index
            ? {
                ...cell,
                output,
                status: payload.status === "success" ? "done" : "error",
                meta: payload.execution_time_ms ? `${Number(payload.execution_time_ms).toFixed(1)} ms` : "",
              }
            : cell
        )
      );
    } catch {
      setNotebookCells((prev) =>
        prev.map((cell, cellIndex) =>
          cellIndex === index ? { ...cell, output: "Notebook run failed.", status: "error", meta: "" } : cell
        )
      );
    }
  };

  const handleSave = async (kind) => {
    const nameByKind = {
      compiler: compilerSaveName,
      app: appSaveName,
      sql: sqlSaveName,
      notebook: notebookSaveName,
    };
    const savesByKind = {
      compiler: compilerSaves,
      app: appSaves,
      sql: sqlSaves,
      notebook: notebookSaves,
    };
    const name = (nameByKind[kind] || "").trim();
    const saves = savesByKind[kind] || [];
    if (!name) return;
    if (saves.length >= effectiveSaveLimit) {
      window.alert(`Only ${effectiveSaveLimit} saved files are allowed. Delete one and try again.`);
      return;
    }
    try {
      const response = await fetch(`${API_BASE}/playground/saves`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: currentUserId,
          module: kind,
          name,
          language:
            kind === "compiler"
              ? language
              : kind === "sql"
                ? "sql"
                : notebookLanguage,
          code:
            kind === "compiler"
              ? activeCompilerContent
              : kind === "app"
                ? appCode
                : kind === "sql"
                  ? sqlQuery
                  : (notebookCells.map((cell) => cell.code).join("\n\n# ---\n") || ""),
          extra:
            kind === "compiler"
              ? {
                  files: compilerFiles,
                  active_file: activeCompilerFile,
                }
              : kind === "sql"
                ? { dataset_id: sqlDatasetId, output: sqlOutput }
                : kind === "notebook"
                  ? { cells: notebookCells, language: notebookLanguage }
                  : {},
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.detail || "Unable to save this file right now.");
      }
      if (kind === "compiler") {
        setCompilerSaves((prev) => [payload, ...prev]);
        setCompilerSaveName("");
        setStatus("Saved");
      } else if (kind === "app") {
        setAppSaves((prev) => [payload, ...prev]);
        setAppSaveName("");
      } else if (kind === "sql") {
        setSqlSaves((prev) => [payload, ...prev]);
        setSqlSaveName("");
      } else if (kind === "notebook") {
        setNotebookSaves((prev) => [payload, ...prev]);
        setNotebookSaveName("");
      }
    } catch (error) {
      window.alert(error.message || "Unable to save this file right now.");
    }
  };

  const loadSave = (kind, item) => {
    if (kind === "compiler") {
      const nextLanguage = item.language || "python";
      const savedFiles = Array.isArray(item.extra?.files)
        ? item.extra.files
            .filter((fileItem) => fileItem && fileItem.name)
            .map((fileItem) => ({ name: String(fileItem.name), content: String(fileItem.content || "") }))
        : [];
      const fileName = getDefaultMainFileName(nextLanguage);
      const nextFiles = savedFiles.length > 0 ? savedFiles : [{ name: fileName, content: item.code || "" }];
      setLanguage(nextLanguage);
      setCompilerFiles(nextFiles);
      const preferredActive = item.extra?.active_file;
      const hasPreferred = preferredActive && nextFiles.some((fileItem) => fileItem.name === preferredActive);
      setActiveCompilerFile(hasPreferred ? preferredActive : nextFiles[0].name);
      setCompilerSyncVersion((prev) => prev + 1);
      setStatus("Loaded");
    } else if (kind === "app") {
      setAppCode(item.code || "");
    } else if (kind === "sql") {
      setSqlQueryForActiveTab(item.code || "");
      setSqlResultColumns([]);
      setSqlResultRows([]);
      setSqlBatchResults([]);
      setSqlRowOffset(0);
      setSqlTotalRows(0);
      if (item.extra?.dataset_id) {
        setSqlDatasetId(item.extra.dataset_id);
      }
      if (item.extra?.output) {
        setSqlOutput(item.extra.output);
      }
    } else if (kind === "notebook") {
      const savedCells = Array.isArray(item.extra?.cells)
        ? item.extra.cells.map((cell, index) => ({
            id: cell.id || `cell-${index + 1}`,
            type: cell.type === "text" ? "text" : "code",
            code: cell.code || "",
            output: cell.output || "",
            status: "idle",
            meta: cell.meta || "",
          }))
        : DEFAULT_NOTEBOOK_CELLS;
      setNotebookCells(savedCells.length > 0 ? savedCells : DEFAULT_NOTEBOOK_CELLS);
      if (item.extra?.language) {
        setNotebookLanguage(item.extra.language);
      }
    }
  };

  const deleteSave = async (kind, id) => {
    try {
      const response = await fetch(`${API_BASE}/playground/saves/${id}?user_id=${currentUserId}`, { method: "DELETE" });
      if (!response.ok) {
        throw new Error("Unable to delete this saved file.");
      }
      const next = (kind === "compiler" ? compilerSaves : appSaves).filter((item) => item.id !== id);
      if (kind === "compiler") {
        setCompilerSaves(next);
      } else if (kind === "app") {
        setAppSaves(next);
      } else if (kind === "sql") {
        setSqlSaves((prev) => prev.filter((item) => item.id !== id));
      } else if (kind === "notebook") {
        setNotebookSaves((prev) => prev.filter((item) => item.id !== id));
      }
    } catch (error) {
      window.alert(error.message || "Unable to delete this saved file.");
    }
  };

  return (
    <div className="space-y-6">
      <section className="erp-card rounded-[30px] border border-[#dbe8ff] bg-gradient-to-r from-white via-[#f8fbff] to-[#eef8ff] p-6 shadow-[0_20px_45px_rgba(37,99,235,0.08)]">
        <p className="text-xs font-semibold uppercase tracking-[0.38em] text-blue-600">Playground</p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900">Premium Developer Playground</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">Compiler first for quick coding. App Playground stays ready for larger interactive previews.</p>
          </div>
          <div className="rounded-[22px] border border-blue-100 bg-white/80 px-4 py-3 text-sm font-semibold text-slate-700">
            Saved slots per workspace: <span className="text-blue-600">{effectiveSaveLimit}</span>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          {modules.map((module) => (
            <button key={module.id} type="button" onClick={() => module.live && setActiveModule(module.id)} className={`rounded-full px-4 py-2 text-sm font-bold ${activeModule === module.id ? "bg-gradient-to-r from-blue-600 to-teal-500 text-white" : module.live ? "border border-blue-100 bg-white text-slate-700" : "border border-slate-200 bg-slate-50 text-slate-400"}`}>
              {module.label} {!module.live && <span className="ml-2 text-[10px] uppercase tracking-[0.25em]">Soon</span>}
            </button>
          ))}
        </div>
      </section>

            {activeModule === "compiler" && (
        <section className="space-y-4">
          <div className="erp-card rounded-[28px] border border-[#dbe8ff] bg-white p-5 shadow-[0_18px_40px_rgba(37,99,235,0.06)]">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.32em] text-blue-700">Online Compiler</p>
                <h2 className="mt-2 text-2xl font-bold text-slate-900">OneCompiler Workspace</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">{COMPILER_LANGUAGE_OPTIONS.length}+ languages</span>
                <span className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">{status}</span>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">{compilerSaves.length}/{effectiveSaveLimit} saves</span>
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr),minmax(0,1fr),auto,auto]">
              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Language</span>
                <select
                  value={language}
                  onChange={(e) => changeCompilerLanguage(e.target.value)}
                  className="w-full rounded-2xl border border-blue-100 bg-[#f8fbff] px-4 py-3 text-sm font-semibold text-slate-700 outline-none"
                >
                  {COMPILER_LANGUAGE_OPTIONS.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="space-y-2">
                <span className="block text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Save</span>
                <div className="flex gap-2">
                  <input
                    value={compilerSaveName}
                    onChange={(e) => setCompilerSaveName(e.target.value)}
                    placeholder="Name"
                    className="w-40 rounded-2xl border border-blue-100 bg-[#f8fbff] px-4 py-3 text-sm text-slate-700 outline-none"
                  />
                  <button type="button" onClick={() => handleSave("compiler")} className="rounded-2xl bg-gradient-to-r from-blue-600 to-teal-500 px-4 py-3 text-sm font-bold text-white">
                    Save
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <span className="block text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Local Run</span>
                <button
                  type="button"
                  onClick={runCompilerLocal}
                  className="rounded-2xl bg-gradient-to-r from-slate-800 to-slate-700 px-5 py-3 text-sm font-bold text-white"
                >
                  {localRunStatus === "running" ? "Running..." : "Run Locally"}
                </button>
              </div>
            </div>
          </div>

          <section className="erp-card rounded-[24px] border border-[#dbe8ff] bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                {compilerFiles.map((fileItem) => (
                  <div key={fileItem.name} className={`flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold ${activeCompilerFile === fileItem.name ? "border-blue-400 bg-blue-50 text-blue-700" : "border-slate-200 bg-slate-50 text-slate-700"}`}>
                    <button type="button" onClick={() => setActiveCompilerTab(fileItem.name)}>
                      {fileItem.name}
                    </button>
                    {compilerFiles.length > 1 && (
                      <button type="button" onClick={() => removeCompilerFile(fileItem.name)} className="ml-1 text-rose-600">
                        x
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button type="button" onClick={addCompilerFile} className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                Add Tab
              </button>
            </div>
          </section>

          <OneCompilerEmbed
            language={language}
            code={activeCompilerContent}
            files={compilerFiles}
            syncVersion={compilerSyncVersion}
            onCodeChange={(nextCode) => {
              setCompilerFiles((prev) => prev.map((item) => (
                item.name === activeCompilerFile ? { ...item, content: nextCode } : item
              )));
              setStatus("Synced");
            }}
            onFilesChange={(nextFiles) => {
              if (!Array.isArray(nextFiles) || nextFiles.length === 0) {
                return;
              }
              setCompilerFiles(nextFiles);
              if (!nextFiles.some((item) => item.name === activeCompilerFile)) {
                setActiveCompilerFile(nextFiles[0].name);
              }
              setStatus("Synced");
            }}
            theme="dark"
            title="Code Editor"
          />

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr),minmax(0,1fr)]">
            <section className="erp-card rounded-[28px] p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-blue-600">Saved Files</p>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">{compilerSaves.length}/{effectiveSaveLimit}</span>
              </div>
              <input
                value={compilerSaveSearch}
                onChange={(e) => setCompilerSaveSearch(e.target.value)}
                placeholder="Search saves"
                className="mt-4 w-full rounded-2xl border border-blue-100 bg-[#f8fbff] px-4 py-3 text-sm text-slate-700 outline-none"
              />
              <div className="mt-4 space-y-2">
                {compilerSaves.length === 0 ? (
                  <p className="text-sm text-slate-500">No saved compiler files yet.</p>
                ) : filteredCompilerSaves.length === 0 ? (
                  <p className="text-sm text-slate-500">No matches found.</p>
                ) : (
                  filteredCompilerSaves.map((item) => (
                    <div key={item.id} className="rounded-[18px] border border-blue-100 bg-blue-50/60 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-800">{item.name}</p>
                          <p className="mt-1 text-xs text-slate-500">{item.language || "python"} · {formatSavedAt(item.updated_at || item.updatedAt)}</p>
                        </div>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => loadSave("compiler", item)} className="rounded-full border border-blue-100 bg-white px-3 py-1 text-xs font-semibold text-blue-700">Load</button>
                          <button type="button" onClick={() => deleteSave("compiler", item.id)} className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">Delete</button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="erp-card rounded-[28px] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-blue-600">Local Runtime Output</p>
              <textarea
                value={localRunInput}
                onChange={(e) => setLocalRunInput(e.target.value)}
                placeholder="Program input (optional)"
                className="mt-4 h-24 w-full rounded-2xl border border-blue-100 bg-[#f8fbff] px-4 py-3 text-sm text-slate-700 outline-none"
              />
              <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{localRunMeta || "Output"}</p>
                <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap text-xs text-slate-700">{localRunOutput}</pre>
              </div>
            </section>
          </div>
        </section>
      )}
      {activeModule === "app" && (
        <section className="space-y-6">
          <div className="erp-card rounded-[24px] border border-blue-100 bg-blue-50/70 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-blue-700">Visual Apps</p>
            <h2 className="mt-2 text-xl font-bold text-slate-900">Streamlit App Samples</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              This section is specifically for interactive apps built with Streamlit. Use it for dashboards, upload tools, note preview apps,
              and other browser-style projects with a live preview.
            </p>
          </div>
          <div className="erp-card rounded-[28px] border border-[#dbe8ff] bg-[#f8fbff] p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-blue-600">Sample Apps</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {APP_TEMPLATES.map((item) => (
                    <button key={item.id} type="button" onClick={() => { setAppTemplateId(item.id); setAppCode(item.code); setAppMessage("Sample app loaded. Launch when you're ready."); }} className={`rounded-full px-4 py-2 text-sm font-semibold ${appTemplateId === item.id ? "bg-gradient-to-r from-blue-600 to-teal-500 text-white" : "border border-blue-100 bg-white text-slate-700"}`}>
                      {item.label}
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">{currentAppTemplate?.note}</p>
              </div>
              <div className="rounded-[20px] border border-teal-100 bg-white px-4 py-3 text-sm font-semibold text-slate-700">Live preview is expanded for a larger dashboard-like experience.</div>
            </div>
          </div>

          <div className="erp-card overflow-hidden rounded-[30px] border border-[#dbe8ff]">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#e8f0ff] bg-[#f8fbff] px-5 py-4">
              <div className="flex items-center gap-3"><div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-[#ff5f57]" /><span className="h-3 w-3 rounded-full bg-[#febc2e]" /><span className="h-3 w-3 rounded-full bg-[#28c840]" /></div><span className="rounded-full border border-blue-100 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-blue-600">Streamlit App Playground</span></div>
              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={launchApp} disabled={appLaunching} className="rounded-full bg-gradient-to-r from-blue-600 to-teal-500 px-5 py-2 text-sm font-bold text-white">{appLaunching ? "Launching..." : "Launch App"}</button>
                <button type="button" onClick={stopApp} className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700">Stop</button>
              </div>
            </div>
            <Editor height="560px" language="python" theme="vs" value={appCode} onChange={(value = "") => setAppCode(value)} options={{ minimap: { enabled: false }, fontSize: 14, smoothScrolling: true, scrollBeyondLastLine: false, padding: { top: 18, bottom: 18 }, fontFamily: "'JetBrains Mono', monospace" }} />
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr),360px]">
            <div className="erp-card rounded-[30px] p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.35em] text-blue-600">Live Preview</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{appMessage}</p>
                </div>
                {appUrl && <a href={appUrl} target="_blank" rel="noreferrer" className="rounded-full border border-blue-100 bg-white px-4 py-2 text-sm font-semibold text-blue-700">Open in new tab</a>}
              </div>
              <div className="mt-4 rounded-[26px] border border-[#d8e6ff] bg-[#fbfdff] p-3">
                {appStatus === "running" && appUrl ? <iframe title="App Preview" src={appUrl} className="h-[980px] w-full rounded-[20px] border border-blue-100 bg-white" /> : <div className="flex h-[980px] items-center justify-center rounded-[20px] border border-dashed border-blue-200 bg-white px-6 text-center text-sm leading-7 text-slate-500">Launch your app to preview it here in a much larger workspace.</div>}
              </div>
            </div>
            <div className="space-y-4">
              <section className="erp-card rounded-[28px] p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-blue-600">App Files</p>
                <input type="file" multiple onChange={(e) => setAppFiles(Array.from(e.target.files || []))} className="mt-4 block w-full rounded-[20px] border border-[#d8e6ff] bg-[#fbfdff] px-4 py-3 text-sm text-slate-700" />
                <div className="mt-3 space-y-2">{appFiles.length === 0 ? <p className="text-sm text-slate-500">Upload app data files here.</p> : appFiles.map((file) => <div key={`${file.name}-${file.size}`} className="rounded-[18px] border border-blue-100 bg-blue-50/70 px-3 py-2 text-sm font-medium text-slate-700">{file.name}</div>)}</div>
              </section>
              <section className="erp-card rounded-[28px] p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-blue-600">Save App</p>
                <div className="mt-4 flex gap-3">
                  <input value={appSaveName} onChange={(e) => setAppSaveName(e.target.value)} placeholder="Enter save name" className="flex-1 rounded-full border border-blue-100 bg-white px-4 py-2 text-sm text-slate-700 outline-none" />
                  <button type="button" onClick={() => handleSave("app")} className="rounded-full bg-gradient-to-r from-blue-600 to-teal-500 px-4 py-2 text-sm font-bold text-white">Save</button>
                </div>
                <div className="mt-4 space-y-2">
                  {appSaves.length === 0 ? <p className="text-sm text-slate-500">No saved app files yet.</p> : appSaves.map((item) => <div key={item.id} className="flex items-center justify-between rounded-[18px] border border-blue-100 bg-blue-50/60 px-3 py-2"><div><p className="text-sm font-semibold text-slate-800">{item.name}</p><p className="text-xs text-slate-500">{formatSavedAt(item.updated_at || item.updatedAt)}</p></div><div className="flex gap-2"><button type="button" onClick={() => loadSave("app", item)} className="rounded-full border border-blue-100 bg-white px-3 py-1 text-xs font-semibold text-blue-700">Load</button><button type="button" onClick={() => deleteSave("app", item.id)} className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">Delete</button></div></div>)}
                </div>
              </section>
              <section className="erp-card rounded-[28px] p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-blue-600">Advanced Notes</p>
                <div className="mt-4 space-y-3 text-sm leading-7 text-slate-600">
                  <p>- Choose from 5 sample app starters and load them instantly.</p>
                  <p>- Upload app data files and access them by filename inside Streamlit.</p>
                  <p>- Save up to {effectiveSaveLimit} app files per user in this browser.</p>
                  <p>- Use the larger live session or open in a new tab for full-screen review.</p>
                </div>
              </section>
            </div>
          </div>
        </section>
      )}

      {activeModule === "sql" && (
        <section className="space-y-5">
          <div className="erp-card rounded-[28px] border border-[#dbe8ff] bg-white p-5">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr),minmax(0,1fr),auto,180px]">
              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Dataset</span>
                <select
                  value={sqlDatasetId}
                  onChange={(e) => setSqlDatasetId(e.target.value)}
                  className="w-full rounded-2xl border border-blue-100 bg-[#f8fbff] px-4 py-3 text-sm font-semibold text-slate-700 outline-none"
                >
                  {sqlDatasets.map((dataset) => (
                    <option key={dataset.id} value={dataset.id}>
                      {dataset.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Save</span>
                <div className="flex gap-2">
                  <input
                    value={sqlSaveName}
                    onChange={(e) => setSqlSaveName(e.target.value)}
                    placeholder="Save name"
                    className="w-full rounded-2xl border border-blue-100 bg-[#f8fbff] px-4 py-3 text-sm text-slate-700 outline-none"
                  />
                  <button type="button" onClick={() => handleSave("sql")} className="rounded-2xl bg-gradient-to-r from-blue-600 to-teal-500 px-4 py-3 text-sm font-bold text-white">
                    Save
                  </button>
                </div>
              </label>
              <div className="space-y-2">
                <span className="block text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Execute</span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => runSqlQuery(0)}
                    disabled={sqlRunning}
                    className="rounded-2xl bg-gradient-to-r from-slate-800 to-slate-700 px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {sqlRunning ? "Running..." : "Run Current"}
                  </button>
                  <button
                    type="button"
                    onClick={runAllSqlQueries}
                    disabled={sqlRunning}
                    className="rounded-2xl border border-blue-200 bg-white px-4 py-3 text-sm font-semibold text-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Run All
                  </button>
                </div>
              </div>
              <label className="space-y-2">
                <span className="block text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Page Size</span>
                <select
                  value={sqlRowLimit}
                  onChange={(e) => {
                    const nextLimit = Number(e.target.value) || SQL_PAGE_SIZE;
                    setSqlRowLimit(nextLimit);
                    setSqlRowOffset(0);
                    if (sqlResultColumns.length > 0 || sqlResultRows.length > 0) {
                      runSqlQuery(0);
                    }
                  }}
                  className="w-full rounded-2xl border border-blue-100 bg-[#f8fbff] px-4 py-3 text-sm font-semibold text-slate-700 outline-none"
                >
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={250}>250</option>
                  <option value={500}>500</option>
                </select>
              </label>
            </div>
            {activeSqlDataset && (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <p className="text-sm text-slate-600">{activeSqlDataset.description}</p>
                {activeSqlDataset.source && (
                  <span className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                    Source: {activeSqlDataset.source}
                  </span>
                )}
                <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                  Dataset rows: {activeSqlDatasetRowCount.toLocaleString()}
                </span>
              </div>
            )}
            {sqlDatasetId === "northwind" && (
              <div className="mt-3 flex flex-wrap items-center gap-3 rounded-2xl border border-blue-100 bg-blue-50/40 px-3 py-2">
                {northwindStatus && (
                  <p className="text-xs text-slate-600">
                    {northwindStatus.message} ({northwindStatus.table_count} tables, {northwindStatus.row_count} rows)
                  </p>
                )}
                {northwindStatus && (
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${northwindStatus.is_complete ? "border border-emerald-100 bg-emerald-50 text-emerald-700" : "border border-amber-100 bg-amber-50 text-amber-700"}`}>
                    {northwindStatus.is_complete ? "Complete core schema" : `Missing: ${northwindStatus.missing_core_tables?.join(", ") || "unknown"}`}
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr),minmax(0,1fr)]">
            <section className="erp-card rounded-[28px] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-blue-600">SQL Editor</p>
              <div className="mt-4 mb-2 flex flex-wrap items-center gap-2">
                {sqlTabs.map((tab) => (
                  <div
                    key={tab.id}
                    className={`flex items-center gap-1 rounded-full border px-3 py-1 text-xs ${
                      tab.id === activeSqlTabId
                        ? "border-blue-300 bg-blue-50 text-blue-700"
                        : "border-slate-200 bg-white text-slate-600"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setActiveSqlTabId(tab.id)}
                      className="font-semibold"
                      title={tab.name}
                    >
                      {tab.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const next = window.prompt("Rename SQL tab", tab.name);
                        if (next !== null) renameSqlTab(tab.id, next);
                      }}
                      className="text-[10px] text-slate-400 hover:text-slate-600"
                      title="Rename tab"
                    >
                      Edit
                    </button>
                    {sqlTabs.length > 1 && (
                      <button
                        type="button"
                        onClick={() => closeSqlTab(tab.id)}
                        className="text-[10px] text-rose-400 hover:text-rose-600"
                        title="Close tab"
                      >
                        x
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addSqlTab}
                  className="ml-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-base font-bold leading-none text-slate-700"
                  title="New SQL tab"
                >
                  +
                </button>
              </div>
              <Editor
                height="420px"
                language="sql"
                theme="vs"
                value={sqlQuery}
                onMount={(editor) => {
                  sqlEditorRef.current = editor;
                }}
                onChange={(value = "") => {
                  setSqlQueryForActiveTab(value);
                  setSqlBatchResults([]);
                  setSqlRowOffset(0);
                }}
                options={{ minimap: { enabled: false }, fontSize: 14, scrollBeyondLastLine: false }}
              />
              <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{sqlMeta || "Output"}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-500">{sqlPageLabel}</span>
                    <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600">
                      Page {sqlCurrentPage || 0}/{sqlTotalPages || 0}
                    </span>
                    <button
                      type="button"
                      onClick={exportSqlResultsCsv}
                      disabled={sqlResultRows.length === 0}
                      className="rounded-full border border-blue-100 bg-white px-3 py-1 text-xs font-semibold text-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Export CSV
                    </button>
                  </div>
                </div>
                {sqlOutput.toLowerCase().includes("timed out") && (
                  <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
                    Query timeout detected. Try adding filters or LIMIT for faster execution.
                  </div>
                )}
                {sqlBatchResults.length > 1 ? (
                  <div className="mt-3 space-y-3">
                    {sqlBatchResults.map((result, idx) => (
                      <div key={result.id} className="rounded-xl border border-slate-200 bg-white p-3">
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-slate-700">
                            Result {idx + 1} • {Number(result.executionTimeMs || 0).toFixed(1)} ms • {result.rowCount} rows
                          </p>
                          <p className="max-w-full truncate text-[11px] text-slate-500">{result.query}</p>
                        </div>
                        {result.columns.length > 0 ? (
                          <div className="max-h-56 overflow-auto rounded-lg border border-slate-200">
                            <table className="min-w-full text-left text-xs text-slate-700">
                              <thead className="sticky top-0 bg-slate-100">
                                <tr>
                                  {result.columns.map((column) => (
                                    <th key={`${result.id}-${column}`} className="border-b border-slate-200 px-3 py-2 font-semibold text-slate-600">
                                      {column}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {result.rows.map((row, rowIndex) => (
                                  <tr key={`${result.id}-row-${rowIndex}`} className={rowIndex % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                                    {result.columns.map((column) => (
                                      <td
                                        key={`${result.id}-cell-${rowIndex}-${column}`}
                                        className={`border-b border-slate-100 px-3 ${playgroundSettings.sqlTableDenseMode ? "py-1 text-[11px]" : "py-2 text-xs"} align-top font-mono`}
                                      >
                                        {String(row?.[column] ?? "")}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <pre className="max-h-56 overflow-auto whitespace-pre-wrap text-xs text-slate-700">{result.output}</pre>
                        )}
                      </div>
                    ))}
                  </div>
                ) : sqlResultColumns.length > 0 ? (
                  <div className="mt-2 max-h-64 overflow-auto rounded-xl border border-slate-200 bg-white">
                    <table className="min-w-full text-left text-xs text-slate-700">
                      <thead className="sticky top-0 bg-slate-100">
                        <tr>
                          {sqlResultColumns.map((column) => (
                            <th key={column} className="border-b border-slate-200 px-3 py-2 font-semibold text-slate-600">
                              {column}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {sqlResultRows.map((row, rowIndex) => (
                          <tr key={`sql-row-${rowIndex}`} className={rowIndex % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                            {sqlResultColumns.map((column) => (
                              <td
                                key={`sql-cell-${rowIndex}-${column}`}
                                className={`border-b border-slate-100 px-3 ${playgroundSettings.sqlTableDenseMode ? "py-1 text-[11px]" : "py-2 text-xs"} align-top font-mono`}
                              >
                                {String(row?.[column] ?? "")}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap text-xs text-slate-700">{sqlOutput}</pre>
                )}
                {sqlResultColumns.length > 0 && (
                  <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                    <div className="flex items-center gap-2">
                      <input
                        value={sqlJumpPage}
                        onChange={(e) => setSqlJumpPage(e.target.value.replace(/[^\d]/g, ""))}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            const target = Number(sqlJumpPage || 0);
                            if (target > 0) {
                              goToSqlPage(target);
                            }
                          }
                        }}
                        placeholder="Page"
                        className="w-20 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700 outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const target = Number(sqlJumpPage || 0);
                          if (target > 0) {
                            goToSqlPage(target);
                          }
                        }}
                        disabled={sqlRunning || !sqlJumpPage}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Go
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => goToSqlPage(sqlCurrentPage - 1)}
                      disabled={sqlRunning || sqlRowOffset <= 0}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      onClick={() => goToSqlPage(sqlCurrentPage + 1)}
                      disabled={sqlRunning || sqlRowOffset + sqlResultRows.length >= sqlTotalRows}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            </section>

            <section className={`erp-card h-full rounded-[28px] ${playgroundSettings.compactSqlSidebar ? "p-4" : "p-5"}`}>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-blue-600">Schema + Saves</p>
              {playgroundSettings.showSchemaDiagrams && activeSqlDataset?.diagram_key && SQL_SCHEMA_IMAGES[activeSqlDataset.diagram_key] && (
                <div className="mt-3 rounded-[20px] border border-blue-100 bg-white p-2">
                  <img
                    src={SQL_SCHEMA_IMAGES[activeSqlDataset.diagram_key]}
                    alt={`${activeSqlDataset.name} schema diagram`}
                    className="w-full rounded-xl border border-blue-50 object-contain"
                  />
                </div>
              )}
              <div className={`mt-3 grid ${playgroundSettings.compactSqlSidebar ? "max-h-[280px]" : "max-h-[360px]"} gap-2 overflow-auto rounded-[20px] border border-blue-100 bg-blue-50/40 p-3 sm:grid-cols-2`}>
                {(activeSqlDataset?.tables || []).map((table) => (
                  <div key={table.name} className="rounded-xl border border-blue-100 bg-white px-3 py-2">
                    <p className="text-sm font-semibold capitalize text-slate-800">
                      {table.name} <span className="text-xs text-slate-500">({table.row_count} rows)</span>
                    </p>
                    <div className="mt-1 space-y-1">
                      {table.columns.map((col) => (
                        <p key={`${table.name}-${col.name}`} className="text-xs text-slate-500">
                          <span className="font-semibold text-slate-700">{col.name}</span> : {col.type}
                        </p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              {(activeSqlDataset?.relationships || []).length > 0 && (
                <div className="mt-3 rounded-[20px] border border-blue-100 bg-white p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Relationships</p>
                  <div className="mt-2 space-y-1">
                    {activeSqlDataset.relationships.map((rel, idx) => (
                      <p key={`${rel.from_table}-${rel.from_column}-${idx}`} className="text-xs text-slate-600">
                        <span className="font-semibold">{rel.from_table}.{rel.from_column}</span>
                        {" -> "}
                        <span className="font-semibold">{rel.to_table}.{rel.to_column}</span>
                      </p>
                    ))}
                  </div>
                </div>
              )}
              <div className="mt-3 rounded-[20px] border border-blue-100 bg-white p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Sample Queries</p>
                <div className="mt-2 space-y-2">
                  {(activeSqlDataset?.sample_queries || []).slice(0, 3).map((query, idx) => (
                    <button
                      key={`sample-${idx}`}
                      type="button"
                      onClick={() => setSqlQueryForActiveTab(query)}
                      className="w-full rounded-xl border border-blue-100 bg-blue-50/40 px-3 py-2 text-left text-xs font-medium text-slate-700"
                    >
                      {query}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-3 rounded-[20px] border border-blue-100 bg-white p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Recent Queries</p>
                  <button
                    type="button"
                    onClick={clearSqlHistory}
                    disabled={sqlHistory.length === 0}
                    className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Clear
                  </button>
                </div>
                <div className="mt-2 space-y-2">
                  {!playgroundSettings.enableSqlHistory ? (
                    <p className="text-xs text-slate-500">SQL history is disabled in Playground Settings.</p>
                  ) : sqlHistory.length === 0 ? (
                    <p className="text-xs text-slate-500">No query history yet.</p>
                  ) : (
                    sqlHistory.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSqlQueryForActiveTab(item.query)}
                        className="w-full rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-left text-xs text-slate-700"
                      >
                        <p className="truncate font-semibold">{item.query}</p>
                        <p className="mt-1 text-[11px] text-slate-500">
                          {Number(item.execution_time_ms || 0).toFixed(1)} ms | {item.row_count || 0} rows
                        </p>
                      </button>
                    ))
                  )}
                </div>
              </div>
              <input
                value={sqlSaveSearch}
                onChange={(e) => setSqlSaveSearch(e.target.value)}
                placeholder="Search saves"
                className="mt-4 w-full rounded-2xl border border-blue-100 bg-[#f8fbff] px-4 py-3 text-sm text-slate-700 outline-none"
              />
              <div className="mt-3 space-y-2">
                {filteredSqlSaves.length === 0 ? (
                  <p className="text-sm text-slate-500">No saved SQL files yet.</p>
                ) : (
                  filteredSqlSaves.map((item) => (
                    <div key={item.id} className="flex items-center justify-between rounded-[18px] border border-blue-100 bg-blue-50/60 px-3 py-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{item.name}</p>
                        <p className="text-xs text-slate-500">{formatSavedAt(item.updated_at || item.updatedAt)}</p>
                      </div>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => loadSave("sql", item)} className="rounded-full border border-blue-100 bg-white px-3 py-1 text-xs font-semibold text-blue-700">Load</button>
                        <button type="button" onClick={() => deleteSave("sql", item.id)} className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">Delete</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </section>
      )}

      {activeModule === "notebook" && (
        <section className="space-y-5">
          <div className="erp-card rounded-[28px] border border-[#dbe8ff] bg-white p-5">
            <div className="grid gap-4 lg:grid-cols-[220px,minmax(0,1fr),auto]">
              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Language</span>
                <select
                  value={notebookLanguage}
                  onChange={(e) => setNotebookLanguage(e.target.value)}
                  className="w-full rounded-2xl border border-blue-100 bg-[#f8fbff] px-4 py-3 text-sm font-semibold text-slate-700 outline-none"
                >
                  <option value="python">Python</option>
                  <option value="javascript">JavaScript</option>
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Save</span>
                <div className="flex gap-2">
                  <input
                    value={notebookSaveName}
                    onChange={(e) => setNotebookSaveName(e.target.value)}
                    placeholder="Save notebook"
                    className="w-full rounded-2xl border border-blue-100 bg-[#f8fbff] px-4 py-3 text-sm text-slate-700 outline-none"
                  />
                  <button type="button" onClick={() => handleSave("notebook")} className="rounded-2xl bg-gradient-to-r from-blue-600 to-teal-500 px-4 py-3 text-sm font-bold text-white">
                    Save
                  </button>
                </div>
              </label>
              <div className="space-y-2">
                <span className="block text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Run</span>
                <button
                  type="button"
                  onClick={runAllNotebookCells}
                  className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700"
                >
                  Run All Cells
                </button>
              </div>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr),minmax(0,1fr)]">
            <section className="space-y-4">
              {notebookCells.map((cell, index) => (
                <div key={cell.id} className="erp-card rounded-[24px] p-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-600">
                        {cell.type === "text" ? `Text ${index + 1}` : `Cell ${index + 1}`}
                      </p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                          cell.status === "running"
                            ? "bg-amber-100 text-amber-700"
                            : cell.status === "done"
                              ? "bg-emerald-100 text-emerald-700"
                              : cell.status === "error"
                                ? "bg-rose-100 text-rose-700"
                                : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {cell.status}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      {cell.type !== "text" && (
                        <button type="button" onClick={() => runNotebookCell(index)} className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                          {cell.status === "running" ? "Running..." : "Run"}
                        </button>
                      )}
                      <button type="button" onClick={() => removeNotebookCell(cell.id)} className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
                        Delete
                      </button>
                    </div>
                  </div>
                  {cell.type === "text" ? (
                    <textarea
                      value={cell.code}
                      onChange={(e) => updateNotebookCell(cell.id, e.target.value)}
                      placeholder="Type markdown notes..."
                      rows={2}
                      className="min-h-[68px] w-full resize-y rounded-2xl border border-blue-100 bg-[#f8fbff] px-4 py-3 text-sm text-slate-700 outline-none"
                    />
                  ) : (
                    <>
                      <Editor
                        height={getNotebookEditorHeight(cell.code)}
                        language={notebookLanguage === "javascript" ? "javascript" : "python"}
                        theme="vs"
                        value={cell.code}
                        onChange={(value = "") => updateNotebookCell(cell.id, value)}
                        options={{ minimap: { enabled: false }, fontSize: 14, scrollBeyondLastLine: false, lineNumbersMinChars: 2 }}
                      />
                      <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{cell.meta || "Output"}</p>
                        <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap text-xs text-slate-700">{cell.output || "(no output yet)"}</pre>
                      </div>
                    </>
                  )}
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => addNotebookCell("code", cell.id)}
                      className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700"
                    >
                      + Code
                    </button>
                    <button
                      type="button"
                      onClick={() => addNotebookCell("text", cell.id)}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700"
                    >
                      + Text
                    </button>
                  </div>
                </div>
              ))}
            </section>

            <section className="erp-card rounded-[28px] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-blue-600">Notebook Saves</p>
              <input
                value={notebookSaveSearch}
                onChange={(e) => setNotebookSaveSearch(e.target.value)}
                placeholder="Search saves"
                className="mt-4 w-full rounded-2xl border border-blue-100 bg-[#f8fbff] px-4 py-3 text-sm text-slate-700 outline-none"
              />
              <div className="mt-4 space-y-2">
                {filteredNotebookSaves.length === 0 ? (
                  <p className="text-sm text-slate-500">No saved notebooks yet.</p>
                ) : (
                  filteredNotebookSaves.map((item) => (
                    <div key={item.id} className="flex items-center justify-between rounded-[18px] border border-blue-100 bg-blue-50/60 px-3 py-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{item.name}</p>
                        <p className="text-xs text-slate-500">{formatSavedAt(item.updated_at || item.updatedAt)}</p>
                      </div>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => loadSave("notebook", item)} className="rounded-full border border-blue-100 bg-white px-3 py-1 text-xs font-semibold text-blue-700">Load</button>
                        <button type="button" onClick={() => deleteSave("notebook", item.id)} className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">Delete</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </section>
      )}

      {!modules.find((item) => item.id === activeModule)?.live && (
        <section className="erp-card rounded-[28px] p-6 text-center">
          <p className="text-sm font-semibold text-slate-500">This submodule is queued next.</p>
        </section>
      )}
    </div>
  );
};

export default Playground;



