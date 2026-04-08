import React, { useEffect, useMemo, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import { API_BASE } from "../utils/api";
import { getStoredUser } from "../utils/roleHelper";

const MODULES = [
  { id: "compiler", label: "Compiler Lab", live: true },
  { id: "app", label: "App Playground", live: true },
  { id: "sql", label: "SQL Playground", live: false },
  { id: "notebook", label: "Notebook Lab", live: false },
];

const SAVE_LIMIT = 5;

const COMPILER_TEMPLATES = {
  python: [
    { id: "py-hello", label: "Python Starter", code: `print("Hello from Python")`, note: "Quick check workspace." },
    { id: "py-calculator", label: "Calculator", code: `num1 = float(input("Enter first number: "))\noperator = input("Choose operator (+, -, *, /): ").strip()\nnum2 = float(input("Enter second number: "))\n\nif operator == "+":\n    print("Result:", num1 + num2)\nelif operator == "-":\n    print("Result:", num1 - num2)\nelif operator == "*":\n    print("Result:", num1 * num2)\nelif operator == "/":\n    if num2 == 0:\n        print("Cannot divide by zero")\n    else:\n        print("Result:", num1 / num2)\nelse:\n    print("Invalid operator")`, note: "Simple CLI calculator for beginners." },
    { id: "py-guessing", label: "Number Guessing", code: `secret = 7\nattempt = int(input("Guess the number (1-10): "))\n\nif attempt == secret:\n    print("Correct! You guessed it.")\nelif attempt < secret:\n    print("Too low.")\nelse:\n    print("Too high.")`, note: "Basic condition-checking practice." },
    { id: "py-palindrome", label: "Palindrome Checker", code: `text = input("Enter a word: ").strip().lower()\ncleaned = "".join(ch for ch in text if ch.isalnum())\n\nif cleaned == cleaned[::-1]:\n    print("It is a palindrome")\nelse:\n    print("It is not a palindrome")`, note: "String practice with slicing." },
    { id: "py-grade", label: "Grade Calculator", code: `marks = [78, 85, 92, 88, 76]\naverage = sum(marks) / len(marks)\n\nprint("Marks:", marks)\nprint("Average:", round(average, 2))\n\nif average >= 90:\n    print("Grade: A")\nelif average >= 75:\n    print("Grade: B")\nelif average >= 60:\n    print("Grade: C")\nelse:\n    print("Grade: D")`, note: "Lists and grading logic." },
    { id: "py-todo-cli", label: "To-Do CLI", code: `tasks = []\n\nwhile True:\n    action = input("Add/List/Quit: ").strip().lower()\n    if action == "add":\n        tasks.append(input("Enter task: ").strip())\n    elif action == "list":\n        if not tasks:\n            print("No tasks yet.")\n        else:\n            for index, task in enumerate(tasks, start=1):\n                print(f"{index}. {task}")\n    elif action == "quit":\n        print("Goodbye!")\n        break\n    else:\n        print("Unknown action")`, note: "Tiny command-line app using loops and lists." },
    { id: "py-converter", label: "Unit Converter", code: `value = float(input("Enter kilometers: "))\nmiles = value * 0.621371\nprint(f"{value} km = {miles:.2f} miles")`, note: "Very simple conversion app." },
    { id: "py-quiz-cli", label: "Quiz CLI", code: `score = 0\n\nanswer = input("Which language is best known for data analysis? ").strip().lower()\nif answer == "python":\n    score += 1\n\nanswer = input("What is 5 * 6? ").strip()\nif answer == "30":\n    score += 1\n\nprint("Final score:", score, "/ 2")`, note: "Beginner quiz using input and conditions." },
    { id: "py-pandas", label: "Pandas + Excel", code: `import pandas as pd\n\ndf = pd.read_excel("your_file.xlsx")\nprint(df.head())\nprint(df.shape)`, note: "Upload an Excel file and inspect it." },
    { id: "py-numpy", label: "NumPy Stats", code: `import numpy as np\n\nvalues = np.array([12, 18, 21, 14, 30, 27])\nprint("Mean:", values.mean())\nprint("Median:", np.median(values))`, note: "Numerical analysis starter." },
    { id: "py-seaborn", label: "Chart Workflow", code: `import pandas as pd\nimport matplotlib.pyplot as plt\nimport seaborn as sns\n\ndf = pd.DataFrame({"month":["Jan","Feb","Mar"],"sales":[120,150,170]})\nsns.barplot(data=df, x="month", y="sales")\nplt.tight_layout()\nplt.savefig("chart.png")\nprint("Saved chart.png")`, note: "Generate a chart image." },
    { id: "py-ml", label: "Scikit-Learn", code: `from sklearn.linear_model import LinearRegression\nimport numpy as np\n\nX = np.array([[1],[2],[3],[4]])\ny = np.array([2,4,6,8])\nmodel = LinearRegression().fit(X,y)\nprint("Prediction for 5:", model.predict([[5]])[0])`, note: "Tiny ML starter." },
  ],
  javascript: [
    { id: "js-hello", label: "JS Starter", code: `console.log("Hello from JavaScript");`, note: "Console practice." },
  ],
  java: [{ id: "java-hello", label: "Java Starter", code: `public class Main {\n  public static void main(String[] args) {\n    System.out.println("Hello from Java");\n  }\n}`, note: "Preview until runtime is enabled." }],
  cpp: [{ id: "cpp-hello", label: "C++ Starter", code: `#include <iostream>\nusing namespace std;\nint main() {\n  cout << "Hello from C++" << endl;\n  return 0;\n}`, note: "Preview until runtime is enabled." }],
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
        st.success(f"{value}°C = {result:.2f}°F")
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
  supported_languages: ["python", "javascript"],
  python_modules: ["pandas", "numpy", "openpyxl", "matplotlib", "streamlit"],
  uploads_supported: true,
  streamlit_supported: true,
};

const formatSavedAt = (value) => {
  if (!value) return "Saved just now";
  const millis = Number(value) * 1000;
  const date = Number.isFinite(millis) ? new Date(millis) : new Date(value);
  return Number.isNaN(date.getTime()) ? "Saved just now" : date.toLocaleString();
};

const MAIN_FILE_BY_LANGUAGE = {
  python: "main.py",
  javascript: "main.js",
  java: "Main.java",
  cpp: "main.cpp",
};

const Playground = () => {
  const currentUser = getStoredUser();
  const currentUserId = currentUser?.id || 1;
  const compilerSocketRef = useRef(null);
  const [activeModule, setActiveModule] = useState("compiler");
  const [capabilities, setCapabilities] = useState(DEFAULT_CAPABILITIES);
  const [language, setLanguage] = useState("python");
  const [compilerTemplateId, setCompilerTemplateId] = useState(COMPILER_TEMPLATES.python[0].id);
  const [code, setCode] = useState(COMPILER_TEMPLATES.python[0].code);
  const [stdin, setStdin] = useState("");
  const [files, setFiles] = useState([]);
  const [output, setOutput] = useState("(no output)");
  const [terminalEntry, setTerminalEntry] = useState("");
  const [status, setStatus] = useState("Ready");
  const [runtime, setRuntime] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [compilerSaveName, setCompilerSaveName] = useState("");
  const [compilerSaves, setCompilerSaves] = useState([]);
  const [activeEditorTab, setActiveEditorTab] = useState("editor");

  const [appTemplateId, setAppTemplateId] = useState(APP_TEMPLATES[0].id);
  const [appCode, setAppCode] = useState(APP_TEMPLATES[0].code);
  const [appFiles, setAppFiles] = useState([]);
  const [appStatus, setAppStatus] = useState("stopped");
  const [appUrl, setAppUrl] = useState("");
  const [appMessage, setAppMessage] = useState("Launch a Streamlit app and preview it here.");
  const [appLaunching, setAppLaunching] = useState(false);
  const [appSaveName, setAppSaveName] = useState("");
  const [appSaves, setAppSaves] = useState([]);

  const stdinHint = useMemo(() => {
    if (language === "python") {
      return "If your code uses input(), type each answer on a new line. Example:\nYogir\n25";
    }
    if (language === "javascript") {
      return "If your script reads stdin, type each value on a new line before clicking Run Code.";
    }
    return "Type program input here, one value per line, before running the code.";
  }, [language]);

  useEffect(() => () => {
    if (compilerSocketRef.current) {
      compilerSocketRef.current.close();
      compilerSocketRef.current = null;
    }
  }, []);

  useEffect(() => {
    fetch(`${API_BASE}/playground/capabilities`).then((r) => (r.ok ? r.json() : null)).then((data) => data && setCapabilities(data)).catch(() => {});
  }, []);

  useEffect(() => {
    const loadBackendSaves = async () => {
      try {
        const [compilerResponse, appResponse] = await Promise.all([
          fetch(`${API_BASE}/playground/saves?user_id=${currentUserId}&module=compiler`),
          fetch(`${API_BASE}/playground/saves?user_id=${currentUserId}&module=app`),
        ]);
        const [compilerPayload, appPayload] = await Promise.all([
          compilerResponse.ok ? compilerResponse.json() : [],
          appResponse.ok ? appResponse.json() : [],
        ]);
        setCompilerSaves(Array.isArray(compilerPayload) ? compilerPayload : []);
        setAppSaves(Array.isArray(appPayload) ? appPayload : []);
      } catch {
        setCompilerSaves([]);
        setAppSaves([]);
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

  const runnableLanguages = capabilities.supported_languages || ["python", "javascript"];
  const currentCompilerTemplates = useMemo(() => COMPILER_TEMPLATES[language] || [], [language]);
  const currentCompilerTemplate = currentCompilerTemplates.find((item) => item.id === compilerTemplateId) || currentCompilerTemplates[0];
  const currentAppTemplate = APP_TEMPLATES.find((item) => item.id === appTemplateId) || APP_TEMPLATES[0];
  const compilerMainFile = MAIN_FILE_BY_LANGUAGE[language] || "main.txt";
  const explorerItems = useMemo(
    () => [
      { id: "editor", name: compilerMainFile, kind: "file", hint: "Editable source file" },
      ...files.map((file) => ({ id: `upload:${file.name}`, name: file.name, kind: "upload", hint: `${Math.max(1, Math.round(file.size / 1024))} KB upload` })),
      ...compilerSaves.slice(0, 3).map((item) => ({ id: `save:${item.id}`, name: item.name, kind: "save", hint: "Saved workspace snapshot" })),
    ],
    [compilerMainFile, files, compilerSaves]
  );

  const selectCompilerTemplate = (nextLanguage, templateId) => {
    const template = (COMPILER_TEMPLATES[nextLanguage] || []).find((item) => item.id === templateId) || (COMPILER_TEMPLATES[nextLanguage] || [])[0];
    setLanguage(nextLanguage);
    setCompilerTemplateId(template?.id || "");
    setCode(template?.code || "");
    setActiveEditorTab("editor");
    setOutput("(no output)");
    setStatus("Ready");
    setRuntime("");
  };

  const closeCompilerSocket = () => {
    if (compilerSocketRef.current) {
      compilerSocketRef.current.close();
      compilerSocketRef.current = null;
    }
  };

  const runCompiler = async () => {
    closeCompilerSocket();
    setIsRunning(true);
    setStatus("Running");
    try {
      if (language === "python") {
        setOutput("");
        setTerminalEntry("");
        const startTime = window.performance.now();
        const wsUrl = `${API_BASE.replace(/^http/, "ws")}/playground/python-terminal`;
        const socket = new window.WebSocket(wsUrl);
        compilerSocketRef.current = socket;

        socket.onopen = () => {
          socket.send(JSON.stringify({ type: "start", code }));
        };

        socket.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data);
            if (payload.type === "status") {
              setStatus("Running");
              return;
            }
            if (payload.type === "output") {
              setOutput((prev) => `${prev}${payload.data}`);
              return;
            }
            if (payload.type === "error") {
              setOutput((prev) => `${prev}${payload.message}\n`);
              setStatus("Run failed");
              setRuntime(`${(window.performance.now() - startTime).toFixed(1)} ms`);
              setIsRunning(false);
              return;
            }
            if (payload.type === "exit") {
              setStatus(payload.returncode === 0 ? "Run completed" : "Run failed");
              setRuntime(`${(window.performance.now() - startTime).toFixed(1)} ms`);
              setIsRunning(false);
              compilerSocketRef.current = null;
            }
          } catch {
            setOutput((prev) => `${prev}${event.data}`);
          }
        };

        socket.onerror = () => {
          setOutput("Unable to start the live terminal session right now.");
          setStatus("Run failed");
          setRuntime("");
          setIsRunning(false);
          compilerSocketRef.current = null;
        };

        socket.onclose = () => {
          compilerSocketRef.current = null;
        };
        return;
      }

      const effectiveStdin = stdin.trim();
      const useFiles = capabilities.uploads_supported && files.length > 0;
      const response = useFiles
        ? await fetch(`${API_BASE}/playground/run-with-files`, {
            method: "POST",
            body: (() => {
              const data = new FormData();
              data.append("language", language);
              data.append("code", code);
              data.append("stdin", effectiveStdin);
              files.forEach((file) => data.append("files", file));
              return data;
            })(),
          })
        : await fetch(`${API_BASE}/playground/run`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ language, code, stdin: effectiveStdin }),
          });
      const payload = await response.json();
      setOutput([payload.output, payload.errors].filter(Boolean).join("\n").trim() || "(no output)");
      setStatus(payload.status === "success" ? "Run completed" : "Run failed");
      setRuntime(payload.execution_time_ms ? `${payload.execution_time_ms.toFixed(1)} ms` : "");
    } catch {
      setOutput("Backend playground runner is unavailable right now.");
      setStatus("Run failed");
      setRuntime("");
    } finally {
      setIsRunning(false);
    }
  };

  const sendTerminalInput = () => {
    const socket = compilerSocketRef.current;
    const value = terminalEntry;
    if (!socket || socket.readyState !== window.WebSocket.OPEN || !value.trim()) {
      return;
    }
    socket.send(JSON.stringify({ type: "input", data: value }));
    setOutput((prev) => `${prev}${value}\n`);
    setTerminalEntry("");
  };

  const stopCompiler = () => {
    if (compilerSocketRef.current && compilerSocketRef.current.readyState === window.WebSocket.OPEN) {
      compilerSocketRef.current.send(JSON.stringify({ type: "terminate" }));
      compilerSocketRef.current.close();
    }
    compilerSocketRef.current = null;
    setIsRunning(false);
    setStatus("Stopped");
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

  const handleSave = async (kind) => {
    const name = (kind === "compiler" ? compilerSaveName : appSaveName).trim();
    const saves = kind === "compiler" ? compilerSaves : appSaves;
    if (!name) return;
    if (saves.length >= SAVE_LIMIT) {
      window.alert(`Only ${SAVE_LIMIT} saved files are allowed. Delete one and try again.`);
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
          language: kind === "compiler" ? language : "python",
          code: kind === "compiler" ? code : appCode,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.detail || "Unable to save this file right now.");
      }
      if (kind === "compiler") {
        setCompilerSaves((prev) => [payload, ...prev]);
        setCompilerSaveName("");
      } else {
        setAppSaves((prev) => [payload, ...prev]);
        setAppSaveName("");
      }
    } catch (error) {
      window.alert(error.message || "Unable to save this file right now.");
    }
  };

  const loadSave = (kind, item) => {
    if (kind === "compiler") {
      setLanguage(item.language || "python");
      setCode(item.code || "");
      setCompilerTemplateId("");
      setActiveEditorTab("editor");
    } else {
      setAppCode(item.code || "");
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
      } else {
        setAppSaves(next);
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
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">Use compiler mode for fast code execution, then switch into App Playground for larger interactive previews. Everything is aligned for a cleaner, more seamless practice flow.</p>
          </div>
          <div className="rounded-[22px] border border-blue-100 bg-white/80 px-4 py-3 text-sm font-semibold text-slate-700">
            Saved slots per workspace: <span className="text-blue-600">{SAVE_LIMIT}</span>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          {MODULES.map((module) => (
            <button key={module.id} type="button" onClick={() => module.live && setActiveModule(module.id)} className={`rounded-full px-4 py-2 text-sm font-bold ${activeModule === module.id ? "bg-gradient-to-r from-blue-600 to-teal-500 text-white" : module.live ? "border border-blue-100 bg-white text-slate-700" : "border border-slate-200 bg-slate-50 text-slate-400"}`}>
              {module.label} {!module.live && <span className="ml-2 text-[10px] uppercase tracking-[0.25em]">Soon</span>}
            </button>
          ))}
        </div>
      </section>

      {activeModule === "compiler" && (
        <section className="space-y-4">
          <div className="erp-card rounded-[24px] border border-emerald-100 bg-emerald-50/70 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-emerald-700">IDE Mode</p>
            <h2 className="mt-2 text-xl font-bold text-slate-900">VS Code Style Playground</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              We kept your browser playground, but laid it out like a mini IDE with an explorer, editor tabs, a bottom terminal, and a right-side workspace panel.
            </p>
          </div>

          <div className="overflow-hidden rounded-[30px] border border-[#dbe8ff] bg-[#101826] shadow-[0_30px_70px_rgba(15,23,42,0.25)]">
            <div className="flex items-center justify-between gap-4 border-b border-[#1f2a3d] bg-[#131d2b] px-5 py-3">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-[#ff5f57]" /><span className="h-3 w-3 rounded-full bg-[#febc2e]" /><span className="h-3 w-3 rounded-full bg-[#28c840]" /></div>
                <span className="text-sm font-semibold text-slate-200">CLG eLab Playground</span>
                <span className="rounded-full border border-slate-700 bg-[#0f1724] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-blue-300">{compilerMainFile}</span>
              </div>
              <div className="flex flex-wrap gap-3">
                <select value={language} onChange={(e) => selectCompilerTemplate(e.target.value, (COMPILER_TEMPLATES[e.target.value] || [])[0]?.id)} className="rounded-full border border-slate-700 bg-[#0f1724] px-4 py-2 text-sm font-semibold text-slate-100 outline-none">
                  {["python", "javascript", "java", "cpp"].map((item) => <option key={item} value={item} disabled={!runnableLanguages.includes(item)}>{item.toUpperCase()} {!runnableLanguages.includes(item) ? "(Soon)" : ""}</option>)}
                </select>
                <button type="button" onClick={runCompiler} disabled={isRunning} className="rounded-full bg-gradient-to-r from-blue-600 to-teal-500 px-5 py-2 text-sm font-bold text-white">{isRunning ? "Running..." : "Run Code"}</button>
                <button type="button" onClick={stopCompiler} disabled={!isRunning} className="rounded-full border border-rose-400/40 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-200 disabled:cursor-not-allowed disabled:opacity-40">Stop</button>
              </div>
            </div>

            <div className="grid min-h-[980px] grid-cols-[56px,240px,minmax(0,1fr),320px]">
              <div className="flex flex-col items-center gap-4 border-r border-[#1f2a3d] bg-[#0c1420] py-4 text-slate-400">
                <span className="rounded-2xl bg-[#162133] px-3 py-2 text-lg text-blue-300">≡</span>
                <span className="rounded-2xl px-3 py-2 text-lg">F</span>
                <span className="rounded-2xl px-3 py-2 text-lg">S</span>
                <span className="rounded-2xl px-3 py-2 text-lg">R</span>
              </div>

              <aside className="border-r border-[#1f2a3d] bg-[#0f1724] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-slate-500">Explorer</p>
                <div className="mt-4 rounded-[20px] border border-slate-800 bg-[#111c2b] p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-300">Workspace</p>
                  <div className="mt-3 space-y-1">
                    {explorerItems.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setActiveEditorTab(item.id)}
                        className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm ${activeEditorTab === item.id ? "bg-blue-500/20 text-white" : "text-slate-300 hover:bg-white/5"}`}
                      >
                        <span className="truncate">{item.name}</span>
                        <span className="ml-2 text-[10px] uppercase tracking-[0.2em] text-slate-500">{item.kind}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-4 rounded-[20px] border border-slate-800 bg-[#111c2b] p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-300">Sample</p>
                  <select value={compilerTemplateId} onChange={(e) => selectCompilerTemplate(language, e.target.value)} className="mt-3 w-full rounded-2xl border border-slate-700 bg-[#0f1724] px-4 py-2 text-sm font-semibold text-slate-100 outline-none">
                    {currentCompilerTemplates.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                  </select>
                  <p className="mt-3 text-sm leading-6 text-slate-400">{currentCompilerTemplate?.note}</p>
                </div>
              </aside>

              <div className="grid min-h-0 grid-rows-[auto,minmax(0,1fr),320px] bg-[#111827]">
                <div className="flex items-center gap-2 border-b border-[#1f2a3d] bg-[#0f1724] px-4 py-2">
                  {explorerItems.slice(0, Math.min(3, explorerItems.length)).map((item) => (
                    <button
                      key={`tab-${item.id}`}
                      type="button"
                      onClick={() => setActiveEditorTab(item.id)}
                      className={`rounded-t-2xl border border-b-0 px-4 py-2 text-sm font-semibold ${activeEditorTab === item.id ? "border-[#2f3f58] bg-[#111827] text-white" : "border-transparent bg-transparent text-slate-400"}`}
                    >
                      {item.name}
                    </button>
                  ))}
                </div>

                <div className="min-h-0">
                  {activeEditorTab === "editor" ? (
                    <Editor height="100%" language={language === "cpp" ? "cpp" : language} theme="vs-dark" value={code} onChange={(value = "") => setCode(value)} options={{ minimap: { enabled: true }, fontSize: 14, smoothScrolling: true, scrollBeyondLastLine: false, padding: { top: 18, bottom: 18 }, fontFamily: "'JetBrains Mono', monospace" }} />
                  ) : (
                    <div className="flex h-full items-center justify-center border-b border-[#1f2a3d] bg-[#111827] p-8 text-center text-sm leading-7 text-slate-400">
                      <div>
                        <p className="text-base font-semibold text-slate-200">{explorerItems.find((item) => item.id === activeEditorTab)?.name || "Workspace item"}</p>
                        <p className="mt-3">This panel is part of the IDE-style explorer. Uploaded files and saved snapshots are listed here so students can navigate the workspace like VS Code.</p>
                        <p className="mt-3">The editable source file remains <span className="font-semibold text-blue-300">{compilerMainFile}</span>.</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="border-t border-[#1f2a3d] bg-[#0a0f18] p-4">
                  <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-3">
                      <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-slate-300">Terminal</span>
                      <span className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">{status}</span>
                    </div>
                    <span className="text-xs font-semibold text-emerald-400">{runtime || "waiting"}</span>
                  </div>
                  <pre className="mt-4 h-[170px] overflow-auto whitespace-pre-wrap rounded-[20px] border border-slate-800 bg-slate-950 p-4 text-sm leading-7 text-slate-100">{output}</pre>
                  {language === "python" && (
                    <div className="mt-4 flex gap-3">
                      <input
                        value={terminalEntry}
                        onChange={(e) => setTerminalEntry(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            sendTerminalInput();
                          }
                        }}
                        placeholder={isRunning ? "Type into terminal and press Enter" : "Run Python code to start the live terminal"}
                        className="flex-1 rounded-full border border-slate-700 bg-[#0f1724] px-4 py-3 text-sm text-slate-100 outline-none"
                      />
                      <button type="button" onClick={sendTerminalInput} disabled={!isRunning} className="rounded-full bg-gradient-to-r from-blue-600 to-teal-500 px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">Enter</button>
                    </div>
                  )}
                  {language !== "python" && (
                    <textarea value={stdin} onChange={(e) => setStdin(e.target.value)} placeholder={stdinHint} className="mt-4 h-24 w-full rounded-[20px] border border-slate-700 bg-[#0f1724] px-4 py-4 text-sm text-slate-100 outline-none" />
                  )}
                </div>
              </div>

              <aside className="border-l border-[#1f2a3d] bg-[#0f1724] p-4">
                <div className="rounded-[20px] border border-slate-800 bg-[#111c2b] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-blue-300">Workspace Actions</p>
                  <div className="mt-4 flex gap-3">
                    <input value={compilerSaveName} onChange={(e) => setCompilerSaveName(e.target.value)} placeholder="Enter save name" className="flex-1 rounded-full border border-slate-700 bg-[#0f1724] px-4 py-2 text-sm text-slate-100 outline-none" />
                    <button type="button" onClick={() => handleSave("compiler")} className="rounded-full bg-gradient-to-r from-blue-600 to-teal-500 px-4 py-2 text-sm font-bold text-white">Save</button>
                  </div>
                  <div className="mt-4 space-y-2">
                    {compilerSaves.length === 0 ? <p className="text-sm text-slate-500">No saved compiler files yet.</p> : compilerSaves.map((item) => <div key={item.id} className="rounded-[18px] border border-slate-800 bg-[#0f1724] px-3 py-3"><div className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-100">{item.name}</p><p className="text-xs text-slate-500">{formatSavedAt(item.updated_at || item.updatedAt)}</p></div><div className="flex gap-2"><button type="button" onClick={() => loadSave("compiler", item)} className="rounded-full border border-slate-700 bg-[#111c2b] px-3 py-1 text-xs font-semibold text-blue-300">Load</button><button type="button" onClick={() => deleteSave("compiler", item.id)} className="rounded-full border border-rose-400/30 bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-200">Delete</button></div></div></div>)}
                  </div>
                </div>

                <div className="mt-4 rounded-[20px] border border-slate-800 bg-[#111c2b] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-blue-300">Workspace Files</p>
                  <input type="file" multiple onChange={(e) => setFiles(Array.from(e.target.files || []))} className="mt-4 block w-full rounded-[20px] border border-slate-700 bg-[#0f1724] px-4 py-3 text-sm text-slate-200" />
                  <div className="mt-3 space-y-2">
                    {files.length === 0 ? <p className="text-sm text-slate-500">No files selected yet.</p> : files.map((file) => <div key={`${file.name}-${file.size}`} className="rounded-[16px] border border-slate-800 bg-[#0f1724] px-3 py-2 text-sm font-medium text-slate-200">{file.name}</div>)}
                  </div>
                </div>

                <div className="mt-4 rounded-[20px] border border-slate-800 bg-[#111c2b] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-blue-300">Runtime</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(capabilities.python_modules || []).slice(0, 10).map((moduleName) => <span key={moduleName} className="rounded-full border border-slate-700 bg-[#0f1724] px-3 py-1 text-xs font-semibold text-slate-300">{moduleName}</span>)}
                  </div>
                  <div className="mt-4 space-y-3 text-sm leading-7 text-slate-400">
                    <p>- Python uses a live terminal session inside the bottom panel.</p>
                    <p>- Uploaded helper files stay listed in the explorer like a mini project workspace.</p>
                    <p>- Java and C++ remain preview-only until runtimes are installed on the machine.</p>
                  </div>
                </div>
              </aside>
            </div>
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
                  <p>- Save up to {SAVE_LIMIT} app files per user in this browser.</p>
                  <p>- Use the larger live session or open in a new tab for full-screen review.</p>
                </div>
              </section>
            </div>
          </div>
        </section>
      )}

      {!MODULES.find((item) => item.id === activeModule)?.live && (
        <section className="erp-card rounded-[28px] p-6 text-center">
          <p className="text-sm font-semibold text-slate-500">This submodule is queued next.</p>
        </section>
      )}
    </div>
  );
};

export default Playground;
