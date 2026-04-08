import React, { useEffect, useMemo, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import { useNavigate, useParams } from "react-router-dom";
import { API_BASE } from "../utils/api";
import { DEFAULT_PROCTOR_SETTINGS, getProctorSettings, isFullscreenActive } from "../utils/proctorSettings";
import { getStoredUser, isPrivilegedRole } from "../utils/roleHelper";
import { getSqlFallbackQuestionById, mergeSqlQuestionDetails } from "../utils/sqlFallbackQuestions";

const LANGUAGES = [
  { id: "python", label: "Python" },
  { id: "javascript", label: "JavaScript" },
  { id: "java", label: "Java" },
  { id: "cpp", label: "C++" },
  { id: "sql", label: "SQL" },
];

const TABS = [
  { id: "description", label: "Description" },
  { id: "examples", label: "Examples" },
  { id: "constraints", label: "Constraints" },
  { id: "submissions", label: "Submissions" },
  { id: "solutions", label: "Solutions" },
];

const FALLBACK_CODE = {
  python: "def solve(*args, **kwargs):\n    # write your logic here\n    pass",
  javascript: "function solve(...args) {\n  // write your logic here\n}\n",
  java: "public class Solution {\n  public static Object solve(Object... args) {\n    return null;\n  }\n}\n",
  cpp: "#include <bits/stdc++.h>\nusing namespace std;\n\nint solve() {\n  return 0;\n}\n",
  sql: "-- Write your SQL query here",
};

const difficultyStyles = {
  easy: "border-emerald-200 bg-emerald-50 text-emerald-700",
  medium: "border-teal-200 bg-teal-50 text-teal-700",
  hard: "border-rose-200 bg-rose-50 text-rose-700",
};

const normalizeLanguage = (value) => {
  if (!value) return "";
  const raw = String(value).toLowerCase();
  if (raw.includes("python")) return "python";
  if (raw.includes("javascript")) return "javascript";
  if (raw.includes("java")) return "java";
  if (raw.includes("cpp")) return "cpp";
  if (raw.includes("sql")) return "sql";
  return raw;
};

const parseTabularText = (value) => {
  const text = String(value || "").trim();
  if (!text) return null;

  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) return null;

  if (lines[0].includes("|")) {
    const headers = lines[0].split("|").map((item) => item.trim()).filter(Boolean);
    const rows = lines.slice(1).map((line) => line.split("|").map((item) => item.trim()));
    if (headers.length > 0 && rows.every((row) => row.length === headers.length)) {
      return { headers, rows };
    }
  }

  if (!lines[0].includes("(") && !lines[0].includes(":")) {
    const headers = [lines[0]];
    const rows = lines.slice(1).map((line) => [line]);
    return { headers, rows };
  }

  return null;
};

const SqlResultTable = ({ title, value, tone = "blue" }) => {
  const parsed = parseTabularText(value);
  const toneClasses =
    tone === "teal"
      ? "border-teal-100 bg-teal-50/50 text-teal-700"
      : "border-blue-100 bg-blue-50/50 text-blue-700";

  return (
    <div className={`rounded-[24px] border p-4 ${toneClasses}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.25em]">{title}</p>
      {parsed ? (
        <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm text-slate-700">
              <thead className="bg-slate-50 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                <tr>
                  {parsed.headers.map((header) => (
                    <th key={header} className="px-4 py-3">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {parsed.rows.map((row, rowIndex) => (
                  <tr key={`${title}-${rowIndex}`} className="border-t border-slate-100">
                    {row.map((cell, cellIndex) => (
                      <td key={`${title}-${rowIndex}-${cellIndex}`} className="px-4 py-3">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <pre className="mt-3 whitespace-pre-wrap rounded-2xl bg-white p-4 text-sm text-slate-800">{value}</pre>
      )}
    </div>
  );
};

const SqlSampleTablesPanel = ({ tables = [] }) => {
  if (!tables.length) return null;

  return (
    <div className="space-y-4">
      {tables.map((table, index) => (
        <div key={`${table.name}-${index}`} className="overflow-hidden rounded-[24px] border border-blue-100 bg-white">
          <div className="border-b border-blue-100 bg-blue-50/60 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-600">{table.name}</p>
          </div>
          <div className="overflow-x-auto">
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
                {(table.rows || []).length > 0 ? (
                  (table.rows || []).map((row, rowIndex) => (
                    <tr key={`${table.name}-${rowIndex}`} className="border-t border-slate-100">
                      {row.map((cell, cellIndex) => (
                        <td key={`${table.name}-${rowIndex}-${cellIndex}`} className="px-4 py-3">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))
                ) : (
                  <tr className="border-t border-slate-100">
                    <td colSpan={(table.columns || []).length || 1} className="px-4 py-4 text-sm text-slate-500">
                      Sample rows are not available yet. Column structure is shown above so you can still build the query.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
};

const formatTimer = (seconds) => {
  const minutes = String(Math.floor(seconds / 60)).padStart(2, "0");
  const remaining = String(seconds % 60).padStart(2, "0");
  return `${minutes}:${remaining}`;
};

const getStoredProgress = (questionId) => {
  if (!questionId) return { attempts: 0, runs: 0, lastRunAt: "", lastAttemptAt: "" };
  try {
    return JSON.parse(localStorage.getItem(`practice-progress-${questionId}`) || "{}");
  } catch {
    return { attempts: 0, runs: 0, lastRunAt: "", lastAttemptAt: "" };
  }
};

const setStoredProgress = (questionId, patch) => {
  if (!questionId) return { attempts: 0, runs: 0, lastRunAt: "", lastAttemptAt: "" };
  const current = getStoredProgress(questionId);
  const next = { ...current, ...patch };
  localStorage.setItem(`practice-progress-${questionId}`, JSON.stringify(next));
  return next;
};

const buildTablesFromSchema = (schemaText) => {
  const raw = String(schemaText || "").trim();
  if (!raw) return [];
  return raw
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
      const nameLine = lines.find((line) => /^Table:/i.test(line));
      const name = nameLine ? nameLine.replace(/^Table:/i, "").trim() : "Table";
      const columns = lines
        .filter((line) => line.startsWith("-"))
        .map((line) => line.replace(/^-/, "").trim().split(/\s+/)[0])
        .filter(Boolean);
      return { name, columns, rows: [] };
    });
};

const normalizeSqlIdentifier = (value) => String(value || "").trim().toLowerCase().replace(/[`"'[\]]/g, "");
const normalizeSqlQuery = (value) =>
  String(value || "")
    .trim()
    .replace(/;+\s*$/, "")
    .replace(/\s+/g, " ")
    .toLowerCase();

const buildSqlAliasMap = (tables = []) => {
  const aliasMap = new Map();
  tables.forEach((table) => {
    const original = String(table.name || "").trim();
    if (!original) return;
    const normalized = normalizeSqlIdentifier(original);
    const aliases = new Set([normalized]);
    if (normalized.endsWith("s")) {
      aliases.add(normalized.slice(0, -1));
    } else {
      aliases.add(`${normalized}s`);
      if (normalized.endsWith("y")) aliases.add(`${normalized.slice(0, -1)}ies`);
    }
    aliases.forEach((alias) => aliasMap.set(alias, table));
  });
  return aliasMap;
};

const formatLocalSqlOutput = (columns = [], rows = []) => {
  if (!columns.length) return "(no output)";
  const lines = [columns.join(" | ")];
  rows.forEach((row) => {
    lines.push(row.map((cell) => (cell == null ? "" : String(cell))).join(" | "));
  });
  return lines.join("\n");
};

const getTableRows = (tables, tableName) => {
  const aliasMap = buildSqlAliasMap(tables);
  const table = aliasMap.get(normalizeSqlIdentifier(tableName));
  if (!table) return [];
  return (table.rows || []).map((row) =>
    Object.fromEntries((table.columns || []).map((column, index) => [column, row[index]])),
  );
};

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const toDate = (value) => new Date(String(value || ""));

const parseSqlLiteral = (expression) => {
  const raw = String(expression || "").trim();
  const aliasMatch = raw.match(/^(.*?)(?:\s+as\s+|\s+)([a-zA-Z_][a-zA-Z0-9_]*)$/i);
  const valuePart = aliasMatch ? aliasMatch[1].trim() : raw;
  const alias = aliasMatch ? aliasMatch[2].trim() : valuePart;

  if (/^null$/i.test(valuePart)) return { header: alias, value: null };
  if (/^'.*'$/.test(valuePart) || /^".*"$/.test(valuePart)) {
    return { header: alias, value: valuePart.slice(1, -1) };
  }
  if (/^-?\d+(?:\.\d+)?$/.test(valuePart)) {
    return { header: alias, value: valuePart };
  }
  return null;
};

const executeSeededSqlQuestion = (question, tables = []) => {
  if (!question?.slug) return null;

  switch (question.slug) {
    case "sql-second-highest-salary": {
      const salaries = [...new Set(getTableRows(tables, "Employee").map((row) => toNumber(row.salary)))].sort((a, b) => b - a);
      return formatLocalSqlOutput(["SecondHighestSalary"], [[salaries[1] ?? null]]);
    }
    case "sql-department-highest-salary": {
      const employees = getTableRows(tables, "Employee");
      const departments = Object.fromEntries(getTableRows(tables, "Department").map((row) => [String(row.id), row.name]));
      const best = {};
      employees.forEach((row) => {
        const departmentId = String(row.departmentId);
        const salary = toNumber(row.salary);
        if (!best[departmentId] || salary > best[departmentId].salary) {
          best[departmentId] = { department: departments[departmentId], employee: row.name, salary };
        }
      });
      return formatLocalSqlOutput(
        ["Department", "Employee", "Salary"],
        Object.values(best)
          .sort((left, right) => String(left.department).localeCompare(String(right.department)))
          .map((row) => [row.department, row.employee, row.salary]),
      );
    }
    case "sql-customers-who-never-order": {
      const ordered = new Set(getTableRows(tables, "Orders").map((row) => String(row.customerId)));
      return formatLocalSqlOutput(
        ["Customers"],
        getTableRows(tables, "Customers")
          .filter((row) => !ordered.has(String(row.id)))
          .map((row) => [row.name]),
      );
    }
    case "sql-duplicate-emails": {
      const counts = {};
      getTableRows(tables, "Person").forEach((row) => {
        counts[row.email] = (counts[row.email] || 0) + 1;
      });
      return formatLocalSqlOutput(["Email"], Object.entries(counts).filter(([, count]) => count > 1).map(([email]) => [email]));
    }
    case "sql-rising-temperature": {
      const weather = getTableRows(tables, "Weather");
      const byDate = Object.fromEntries(weather.map((row) => [String(row.recordDate), row]));
      return formatLocalSqlOutput(
        ["Id"],
        weather
          .filter((row) => {
            const previous = new Date(toDate(row.recordDate).getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
            return byDate[previous] && toNumber(row.temperature) > toNumber(byDate[previous].temperature);
          })
          .map((row) => [row.id]),
      );
    }
    case "sql-product-sales-analysis": {
      const products = Object.fromEntries(getTableRows(tables, "Product").map((row) => [String(row.product_id), row]));
      const revenue = {};
      getTableRows(tables, "Sales").forEach((row) => {
        const product = products[String(row.product_id)];
        if (!product) return;
        revenue[product.product_name] = (revenue[product.product_name] || 0) + toNumber(product.price) * toNumber(row.units);
      });
      return formatLocalSqlOutput(["product_name", "revenue"], Object.entries(revenue).map(([name, total]) => [name, total]));
    }
    case "sql-monthly-transaction-totals": {
      const grouped = {};
      getTableRows(tables, "Transactions").forEach((row) => {
        const month = String(row.trans_date).slice(0, 7);
        grouped[month] = grouped[month] || { count: 0, amount: 0 };
        grouped[month].count += 1;
        grouped[month].amount += Number(row.amount || 0);
      });
      return formatLocalSqlOutput(
        ["month", "transaction_count", "total_amount"],
        Object.keys(grouped)
          .sort()
          .map((month) => [month, grouped[month].count, grouped[month].amount.toFixed(2)]),
      );
    }
    case "sql-managers-with-five-reports": {
      const employees = getTableRows(tables, "Employee");
      const counts = {};
      employees.forEach((row) => {
        const managerId = String(row.managerId);
        if (!managerId || managerId === "NULL") return;
        counts[managerId] = (counts[managerId] || 0) + 1;
      });
      return formatLocalSqlOutput(
        ["name"],
        employees.filter((row) => (counts[String(row.id)] || 0) >= 5).map((row) => [row.name]),
      );
    }
    case "sql-top-customer-by-orders": {
      const customers = Object.fromEntries(getTableRows(tables, "Customers").map((row) => [String(row.id), row.name]));
      const counts = {};
      getTableRows(tables, "Orders").forEach((row) => {
        counts[String(row.customer_id)] = (counts[String(row.customer_id)] || 0) + 1;
      });
      const maxOrders = Math.max(...Object.values(counts).map(Number), 0);
      return formatLocalSqlOutput(
        ["customer_name", "order_count"],
        Object.entries(counts)
          .filter(([, count]) => count === maxOrders)
          .map(([customerId, count]) => [customers[customerId], count]),
      );
    }
    case "sql-employees-earning-more-than-manager": {
      const employees = getTableRows(tables, "Employee");
      const byId = Object.fromEntries(employees.map((row) => [String(row.id), row]));
      return formatLocalSqlOutput(
        ["Employee"],
        employees
          .filter((row) => {
            const manager = byId[String(row.managerId)];
            return manager && toNumber(row.salary) > toNumber(manager.salary);
          })
          .map((row) => [row.name]),
      );
    }
    case "sql-daily-active-users": {
      const grouped = {};
      getTableRows(tables, "Activity").forEach((row) => {
        const date = String(row.activity_date);
        grouped[date] = grouped[date] || new Set();
        grouped[date].add(String(row.user_id));
      });
      return formatLocalSqlOutput(
        ["activity_date", "active_users"],
        Object.keys(grouped)
          .sort()
          .map((date) => [date, grouped[date].size]),
      );
    }
    default:
      return null;
  }
};

const evaluateLocalSql = (query, tables = [], question = null) => {
  const sql = String(query || "").trim().replace(/\s+/g, " ");
  if (!sql) {
    return { output: "(no output)", status: "error", errors: "Write an SQL query before running it." };
  }

  const aliasMap = buildSqlAliasMap(tables);
  const simpleTableQuery = sql.match(
    /^select\s+(\*|[a-zA-Z0-9_.*,\s"`\[\]]+)\s+from\s+([a-zA-Z0-9_"`\[\]]+)(?:\s+limit\s+(\d+))?\s*;?$/i,
  );
  if (simpleTableQuery) {
    const [, rawColumns, rawTable, rawLimit] = simpleTableQuery;
    const table = aliasMap.get(normalizeSqlIdentifier(rawTable));
    if (!table) {
      return {
        output: "(no output)",
        status: "error",
        errors: `Table ${rawTable} is not available in the practice data.`,
      };
    }

    const allColumns = table.columns || [];
    const limit = rawLimit ? Number(rawLimit) : undefined;
    const normalizedColumnText = rawColumns.trim().toLowerCase();
    const useAllColumns = normalizedColumnText === "*" || normalizedColumnText.endsWith(".*");
    const selectedColumns = useAllColumns
      ? allColumns
      : rawColumns
          .split(",")
          .map((column) => normalizeSqlIdentifier(column.split(".").pop()))
          .filter(Boolean);

    const resolvedIndexes = selectedColumns.map((column) =>
      allColumns.findIndex((candidate) => normalizeSqlIdentifier(candidate) === normalizeSqlIdentifier(column)),
    );

    if (resolvedIndexes.some((index) => index === -1)) {
      return {
        output: "(no output)",
        status: "error",
        errors: `Available columns in ${table.name}: ${allColumns.join(", ")}`,
      };
    }

    const rows = (table.rows || [])
      .slice(0, limit || undefined)
      .map((row) => resolvedIndexes.map((index) => row[index]));

    return {
      output: formatLocalSqlOutput(selectedColumns.map((_, index) => allColumns[resolvedIndexes[index]]), rows),
      status: "success",
      errors: null,
    };
  }

  const literalSelectMatch = sql.match(/^select\s+(.+?)\s*;?$/i);
  if (literalSelectMatch && !/\sfrom\s/i.test(sql)) {
    const expressions = literalSelectMatch[1].split(",").map((item) => item.trim()).filter(Boolean);
    const parsed = expressions.map(parseSqlLiteral);
    if (parsed.every(Boolean)) {
      return {
        output: formatLocalSqlOutput(
          parsed.map((item) => item.header),
          [parsed.map((item) => item.value)],
        ),
        status: "success",
        errors: null,
      };
    }
  }

  const normalizedQuery = normalizeSqlQuery(sql);
  const normalizedAcceptedQueries = (question?.solutions || [])
    .filter((entry) => normalizeLanguage(entry.language) === "sql")
    .map((entry) => normalizeSqlQuery(entry.code));

  if (normalizedAcceptedQueries.includes(normalizedQuery)) {
    const seededResult = executeSeededSqlQuestion(question, tables);
    if (seededResult) {
      return {
        output: seededResult,
        status: "success",
        errors: null,
      };
    }
  }

  return {
    output: "(no output)",
    status: "error",
    errors: "This local SQL fallback currently supports direct table queries and the seeded accepted SQL solution patterns. Restart the backend for full SQL execution.",
  };
};

const PracticeArena = () => {
  const { questionId } = useParams();
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const draftRef = useRef({ code: FALLBACK_CODE.python, notes: "" });
  const hasDraftChangesRef = useRef(false);
  const [user, setUser] = useState(getStoredUser());
  const [question, setQuestion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [language, setLanguage] = useState("python");
  const [code, setCode] = useState(FALLBACK_CODE.python);
  const [customInput, setCustomInput] = useState("nums = [1, 2, 3, 4]\ntarget = 6");
  const [activeTab, setActiveTab] = useState("description");
  const [consoleTab, setConsoleTab] = useState("output");
  const [consoleOutput, setConsoleOutput] = useState("(no output)");
  const [testResults, setTestResults] = useState([]);
  const [statusMessage, setStatusMessage] = useState("Ready");
  const [submissionSummary, setSubmissionSummary] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [split, setSplit] = useState(0.49);
  const [isResizing, setIsResizing] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [notesOpen, setNotesOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notesContent, setNotesContent] = useState("");
  const [fontSize, setFontSize] = useState(14);
  const [tabSize, setTabSize] = useState(2);
  const [proctorSettings, setProctorSettings] = useState(() => getProctorSettings());
  const [guardOverlayOpen, setGuardOverlayOpen] = useState(false);
  const [saveNotice, setSaveNotice] = useState("");
  const [streak, setStreak] = useState(() => Number(localStorage.getItem("practice-streak") || "0"));
  const [isSolved, setIsSolved] = useState(false);
  const [solutionLanguage, setSolutionLanguage] = useState("python");
  const [progress, setProgress] = useState({ attempts: 0, runs: 0, lastRunAt: "", lastAttemptAt: "" });

  const isPrivileged = isPrivilegedRole(user?.role);
  const copyPasteLocked = proctorSettings.copyPasteLocked;
  const proctorModeActive = copyPasteLocked && !isPrivileged;
  const selectionLocked = proctorModeActive && proctorSettings.blockQuestionSelection;
  const notesDisabledForStudent = !isPrivileged && proctorSettings.disableStudentNotes;
  const canViewSolutions = isPrivileged || isSolved;
  const difficulty = question?.difficulty?.toLowerCase() || "medium";
  const isSqlQuestion = question?.category === "sql";

  const starterCodes = useMemo(() => {
    const mapping = {};
    (question?.starter_codes || []).forEach((entry) => {
      mapping[normalizeLanguage(entry.language)] = entry.code;
    });
    return mapping;
  }, [question]);

  const solutionsByLanguage = useMemo(() => {
    const grouped = {};
    (question?.solutions || []).forEach((entry) => {
      const key = normalizeLanguage(entry.language) || "python";
      grouped[key] = [...(grouped[key] || []), entry];
    });
    return grouped;
  }, [question]);

  const availableSolutionLanguages = useMemo(() => Object.keys(solutionsByLanguage), [solutionsByLanguage]);

  const visibleResults = useMemo(() => testResults.filter((item) => !item.is_hidden), [testResults]);
  const hiddenResults = useMemo(() => testResults.filter((item) => item.is_hidden), [testResults]);
  const displaySampleTables = useMemo(() => {
    if (!isSqlQuestion) return [];
    if ((question?.sample_tables || []).length > 0) return question.sample_tables || [];
    return buildTablesFromSchema(question?.sql_schema);
  }, [isSqlQuestion, question]);

  const buildLocalSqlPayload = (mode = "run") => {
    const local = evaluateLocalSql(code, displaySampleTables, question);
    const normalizedActual = String(local.output || "").trim();
    const normalizedExpected = String(question?.expected_output || "").trim();
    const passed = local.status === "success" && (!normalizedExpected || normalizedActual === normalizedExpected);
    const isSubmit = mode === "submit";

    return {
      output: local.output,
      status: isSubmit ? (passed ? "success" : "error") : local.status,
      errors: isSubmit ? (passed ? null : local.errors || "Query result did not match the expected output.") : local.errors,
      execution_time_ms: 0,
      visible_total: isSubmit ? 1 : 0,
      visible_passed: isSubmit && passed ? 1 : 0,
      hidden_total: isSubmit ? Math.max((question?.solutions || []).filter((item) => normalizeLanguage(item.language) === "sql").length - 1, 0) : 0,
      hidden_passed: isSubmit && passed ? Math.max((question?.solutions || []).filter((item) => normalizeLanguage(item.language) === "sql").length - 1, 0) : 0,
      test_case_results: isSubmit
        ? [
            {
              id: 1,
              actual_output: local.output || "(no output)",
              expected_output: question?.expected_output || "(no output)",
              passed,
              is_hidden: false,
            },
          ]
        : [],
    };
  };

  useEffect(() => {
    const handleStorage = () => setUser(getStoredUser());
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  useEffect(() => {
    const syncSettings = () => setProctorSettings(getProctorSettings());
    window.addEventListener("storage", syncSettings);
    window.addEventListener("practice-proctor-settings-updated", syncSettings);
    return () => {
      window.removeEventListener("storage", syncSettings);
      window.removeEventListener("practice-proctor-settings-updated", syncSettings);
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const fetchQuestion = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`${API_BASE}/questions/${questionId}`, { signal: controller.signal });
        if (!response.ok) {
          const fallbackQuestion = getSqlFallbackQuestionById(questionId);
          if (fallbackQuestion) {
            setQuestion(fallbackQuestion);
            setError("");
            return;
          }
          throw new Error("Unable to load the selected question");
        }
        const payload = await response.json();
        setQuestion(mergeSqlQuestionDetails(payload));
      } catch (requestError) {
        if (requestError.name !== "AbortError") {
          const fallbackQuestion = getSqlFallbackQuestionById(questionId);
          if (fallbackQuestion) {
            setQuestion(mergeSqlQuestionDetails(fallbackQuestion));
            setError("");
          } else {
            setError(requestError.message || "Failed to fetch question");
          }
        }
      } finally {
        setLoading(false);
      }
    };
    fetchQuestion();
    return () => controller.abort();
  }, [questionId]);

  useEffect(() => {
    if (!question?.id) return;
    const nextLanguage = isSqlQuestion ? "sql" : (language === "sql" ? "python" : language);
    if (language !== nextLanguage) {
      setLanguage(nextLanguage);
      return;
    }
    const starter = isSqlQuestion ? FALLBACK_CODE.sql : starterCodes[nextLanguage] || FALLBACK_CODE[nextLanguage];
    setCode(localStorage.getItem(`practice-code-${question.id}-${nextLanguage}`) || starter);
    setNotesContent(localStorage.getItem(`practice-notes-${question.id}`) || "");
    setConsoleOutput("(no output)");
    setConsoleTab("output");
    setActiveTab("description");
    setTimerSeconds(0);
    setSubmissionSummary(null);
    setTestResults([]);
    setIsSolved(localStorage.getItem(`practice-solved-${question.id}`) === "true");
    setSolutionLanguage(isSqlQuestion ? "sql" : "python");
    setProgress(getStoredProgress(question.id));
    draftRef.current = {
      code: localStorage.getItem(`practice-code-${question.id}-${nextLanguage}`) || starter,
      notes: localStorage.getItem(`practice-notes-${question.id}`) || "",
    };
    hasDraftChangesRef.current = false;
  }, [question, language, starterCodes, isSqlQuestion]);

  useEffect(() => {
    draftRef.current = { code, notes: notesContent };
  }, [code, notesContent]);

  useEffect(() => {
    if (!question?.id) return undefined;
    const currentQuestionId = question.id;
    const currentLanguage = language;
    return () => {
      if (!hasDraftChangesRef.current) return;
      localStorage.setItem(`practice-code-${currentQuestionId}-${currentLanguage}`, draftRef.current.code);
      localStorage.setItem(`practice-notes-${currentQuestionId}`, draftRef.current.notes);
      hasDraftChangesRef.current = false;
    };
  }, [question?.id, language]);

  useEffect(() => {
    if (!question?.id) return undefined;
    const currentQuestionId = question.id;
    const currentLanguage = language;
    const persistDraftOnUnload = () => {
      if (!hasDraftChangesRef.current) return;
      localStorage.setItem(`practice-code-${currentQuestionId}-${currentLanguage}`, draftRef.current.code);
      localStorage.setItem(`practice-notes-${currentQuestionId}`, draftRef.current.notes);
    };
    window.addEventListener("beforeunload", persistDraftOnUnload);
    return () => window.removeEventListener("beforeunload", persistDraftOnUnload);
  }, [question?.id, language]);

  useEffect(() => {
    if (!availableSolutionLanguages.length) return;
    if (!availableSolutionLanguages.includes(solutionLanguage)) {
      setSolutionLanguage(availableSolutionLanguages[0]);
    }
  }, [availableSolutionLanguages, solutionLanguage]);

  useEffect(() => {
    if (!question?.id) return undefined;
    const timer = window.setInterval(() => setTimerSeconds((current) => current + 1), 1000);
    return () => window.clearInterval(timer);
  }, [question?.id]);

  useEffect(() => {
    if (!saveNotice) return undefined;
    const timeout = window.setTimeout(() => setSaveNotice(""), 2200);
    return () => window.clearTimeout(timeout);
  }, [saveNotice]);

  useEffect(() => {
    if (!proctorModeActive) return undefined;

    const blockedCombinations = (event) => {
      const key = String(event.key || "").toLowerCase();
      const usesModifier = event.ctrlKey || event.metaKey;
      const shouldBlock =
        key === "contextmenu" ||
        (usesModifier && ["c", "x", "v", "a", "insert"].includes(key)) ||
        (event.shiftKey && ["insert", "delete"].includes(key));

      if (shouldBlock) {
        event.preventDefault();
        event.stopPropagation();
        setSaveNotice("Proctored mode is enabled. Copy, paste, cut, and select-all are disabled for students.");
      }
    };

    window.addEventListener("keydown", blockedCombinations, true);
    return () => window.removeEventListener("keydown", blockedCombinations, true);
  }, [proctorModeActive]);

  useEffect(() => {
    if (isPrivileged || !proctorSettings.extensionGuardEnabled) return undefined;

    const openGuard = () => {
      if (proctorSettings.blurOnFocusLoss || (proctorSettings.requireFullscreen && !isFullscreenActive())) {
        setGuardOverlayOpen(true);
      }
    };

    const handleVisibility = () => {
      if (document.hidden) openGuard();
    };

    const handleBlur = () => openGuard();
    const handleFullscreenChange = () => {
      if (proctorSettings.requireFullscreen && !isFullscreenActive()) {
        setGuardOverlayOpen(true);
      }
    };

    window.addEventListener("blur", handleBlur);
    document.addEventListener("visibilitychange", handleVisibility);
    document.addEventListener("fullscreenchange", handleFullscreenChange);

    if (proctorSettings.requireFullscreen && !isFullscreenActive()) {
      setGuardOverlayOpen(true);
    }

    return () => {
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("visibilitychange", handleVisibility);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, [isPrivileged, proctorSettings]);

  useEffect(() => {
    const handleMove = (event) => {
      if (!isResizing || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const next = (event.clientX - rect.left) / rect.width;
      setSplit(Math.max(0.32, Math.min(0.7, next)));
    };
    const stopResize = () => setIsResizing(false);
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", stopResize);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", stopResize);
    };
  }, [isResizing]);

  const handleResponse = (payload, label) => {
    const output = [payload.output, payload.errors].filter(Boolean).join("\n").trim();
    setConsoleOutput(output || "(no output)");
    setTestResults(payload.test_case_results || []);
    setStatusMessage(`${label} ${payload.status === "success" ? "completed" : "failed"}`);
    return {
      total: (payload.visible_total || 0) + (payload.hidden_total || 0),
      passed: (payload.visible_passed || 0) + (payload.hidden_passed || 0),
      status: payload.status,
    };
  };

  const callRunner = async (endpoint) => {
    const response = await fetch(`${API_BASE}/questions/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        language,
        input: customInput,
        question_id: question.id,
        question_slug: question.slug,
        question_title: question.title,
      }),
    });
    if (!response.ok) throw new Error(`Unable to ${endpoint === "run-code" ? "run" : "submit"} code`);
    return response.json();
  };

  const handleRun = async () => {
    if (!question) return;
    setIsRunning(true);
    try {
      const nextProgress = setStoredProgress(question.id, {
        runs: Number(getStoredProgress(question.id).runs || 0) + 1,
        lastRunAt: new Date().toISOString(),
      });
      setProgress(nextProgress);
      localStorage.setItem(`practice-attempted-${question.id}`, "true");
      let payload = await callRunner("run-code");
      if (
        isSqlQuestion &&
        String(payload?.errors || "").toLowerCase().includes("sample tables are not available")
      ) {
        payload = buildLocalSqlPayload("run");
      }
      handleResponse(payload, "Run");
      setConsoleTab("output");
      setSubmissionSummary(null);
    } catch (requestError) {
      if (isSqlQuestion) {
        const payload = buildLocalSqlPayload("run");
        if (payload.status === "success") {
          handleResponse(payload, "Run");
          setConsoleTab("output");
          setSubmissionSummary(null);
        } else {
          setConsoleOutput(
            "Full SQL execution requires the backend SQL engine.\nStart the backend to run advanced queries, joins, subqueries, aggregates, and playground-style SQL safely.",
          );
          setStatusMessage("Run failed");
        }
      } else {
        setConsoleOutput(requestError.message || "Execution failed");
        setStatusMessage("Run failed");
      }
    } finally {
      setIsRunning(false);
    }
  };

  const handleSubmit = async () => {
    if (!question) return;
    setIsSubmitting(true);
    try {
      const currentProgress = getStoredProgress(question.id);
      const nextProgress = setStoredProgress(question.id, {
        attempts: Number(currentProgress.attempts || 0) + 1,
        lastAttemptAt: new Date().toISOString(),
      });
      setProgress(nextProgress);
      localStorage.setItem(`practice-attempted-${question.id}`, "true");
      let payload = await callRunner("submit");
      if (
        isSqlQuestion &&
        String(payload?.errors || "").toLowerCase().includes("sample tables are not available")
      ) {
        payload = buildLocalSqlPayload("submit");
      }
      const summary = handleResponse(payload, "Submit");
      setSubmissionSummary(summary);
      setConsoleTab("tests");
      if (summary.total > 0 && summary.total === summary.passed && summary.status === "success") {
        localStorage.setItem(`practice-solved-${question.id}`, "true");
        setIsSolved(true);
        const today = new Date().toISOString().slice(0, 10);
        const solvedDays = JSON.parse(localStorage.getItem("practice-solved-days") || "[]");
        if (!solvedDays.includes(today)) {
          localStorage.setItem("practice-solved-days", JSON.stringify([...solvedDays, today]));
        }
        setStoredProgress(question.id, { solvedAt: new Date().toISOString() });
        setStreak((current) => {
          const next = current + 1;
          localStorage.setItem("practice-streak", String(next));
          return next;
        });
      }
    } catch (requestError) {
      if (isSqlQuestion) {
        const payload = buildLocalSqlPayload("submit");
        if (payload.status === "success") {
          const summary = handleResponse(payload, "Submit");
          setSubmissionSummary(summary);
          setConsoleTab("tests");
        } else {
          setConsoleOutput(
            "Full SQL submission requires the backend SQL engine.\nStart the backend to validate advanced SQL queries against the practice data.",
          );
          setStatusMessage("Submit failed");
        }
      } else {
        setConsoleOutput(requestError.message || "Submission failed");
        setStatusMessage("Submit failed");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveCode = () => {
    if (!question?.id) return;
    localStorage.setItem(`practice-code-${question.id}-${language}`, code);
    hasDraftChangesRef.current = false;
    setSaveNotice("Code saved locally");
  };

  const handleResetCode = () => {
    if (!question?.id) return;
    setCode(isSqlQuestion ? FALLBACK_CODE.sql : starterCodes[language] || FALLBACK_CODE[language]);
    hasDraftChangesRef.current = true;
    setSaveNotice("Starter code restored");
  };

  const handleSaveNotes = () => {
    if (!question?.id) return;
    localStorage.setItem(`practice-notes-${question.id}`, notesContent);
    hasDraftChangesRef.current = false;
    setSaveNotice("Notes saved");
    setNotesOpen(false);
  };

  const formatRelativeTime = (value) => {
    if (!value) return "Never";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Never";
    return date.toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const blockProtectedAction = (event, actionLabel = "This action") => {
    if (!proctorModeActive) return false;
    event.preventDefault();
    event.stopPropagation();
    setSaveNotice(`Proctored mode: ${actionLabel} is disabled for students.`);
    return true;
  };

  const handleResumeGuardedWorkspace = async () => {
    if (proctorSettings.requireFullscreen && !isFullscreenActive()) {
      try {
        await document.documentElement.requestFullscreen();
      } catch {
        setSaveNotice("Fullscreen permission was denied. Please try again.");
        return;
      }
    }
    setGuardOverlayOpen(false);
  };

  const renderTabContent = () => {
    if (!question) return null;
    const descriptionLines = String(question.problem_statement || "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    if (activeTab === "description") {
      return (
        <div className="space-y-5 text-sm leading-7 text-slate-600">
          <div className="rounded-[24px] border border-blue-100 bg-gradient-to-br from-blue-50 to-cyan-50 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-600">Quick Brief</p>
            <p className="mt-3 text-base font-semibold text-slate-800">
              {question.short_description || question.title}
            </p>
          </div>
          <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Detailed Explanation</p>
            <div className="mt-4 space-y-4">
              {descriptionLines.map((line, index) => (
                <p key={`${index}-${line.slice(0, 24)}`} className="leading-7 text-slate-700">
                  {line}
                </p>
              ))}
            </div>
          </div>
          {question.diagram_url && (
            <div className="overflow-hidden rounded-[24px] border border-blue-100 bg-blue-50/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-600">Diagram</p>
              <img
                src={question.diagram_url}
                alt={question.diagram_caption || question.title}
                className="mt-3 max-h-80 w-full rounded-2xl border border-blue-100 bg-white object-contain"
              />
              {question.diagram_caption && <p className="mt-3 text-sm text-slate-600">{question.diagram_caption}</p>}
            </div>
          )}
          {question.function_signature && (
            <div className="rounded-[24px] border border-blue-100 bg-blue-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-600">Function Signature</p>
              <pre className="mt-3 whitespace-pre-wrap text-sm text-slate-800">{question.function_signature}</pre>
            </div>
          )}
          {isSqlQuestion && question.sql_schema && (
            <div className="rounded-[24px] border border-blue-100 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-600">Practice Data Schema</p>
              <pre className="mt-3 whitespace-pre-wrap rounded-2xl bg-slate-50 p-4 text-sm text-slate-800">
                {question.sql_schema}
              </pre>
            </div>
          )}
          {isSqlQuestion && displaySampleTables.length > 0 && (
            <div className="rounded-[24px] border border-blue-100 bg-blue-50/40 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-600">Practice Data Tables</p>
              <div className="mt-3">
                <SqlSampleTablesPanel tables={displaySampleTables} />
              </div>
            </div>
          )}
          {question.input_format && (
            <div className="rounded-[24px] border border-blue-100 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-600">Input Format</p>
              <p className="mt-2">{question.input_format}</p>
            </div>
          )}
          {question.output_format && (
            <div className="rounded-[24px] border border-teal-100 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-600">Output Format</p>
              <p className="mt-2">{question.output_format}</p>
            </div>
          )}
          {isSqlQuestion && question.expected_output && (
            <SqlResultTable title="Expected Result Snapshot" value={question.expected_output} tone="teal" />
          )}
        </div>
      );
    }

    if (activeTab === "examples") {
      if ((question.examples || []).length === 0) {
        return <p className="text-sm text-slate-500">No examples available yet.</p>;
      }
      return (
        <div className="space-y-4">
          {question.examples.map((example, index) => (
            <div key={example.id || index} className="rounded-[24px] border border-teal-100 bg-teal-50/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-teal-700">Example {index + 1}</p>
              {isSqlQuestion ? (
                <div className="mt-3 grid gap-4">
                  {displaySampleTables.length > 0 ? (
                    <SqlSampleTablesPanel tables={displaySampleTables} />
                  ) : (
                    <div className="rounded-[20px] border border-blue-100 bg-white p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-600">Practice Data Tables</p>
                      <pre className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{example.input}</pre>
                    </div>
                  )}
                  <SqlResultTable title="Sample Output" value={example.output} tone="teal" />
                </div>
              ) : (
                <>
                  <pre className="mt-3 whitespace-pre-wrap text-sm text-slate-700">Input: {example.input}</pre>
                  <pre className="mt-3 whitespace-pre-wrap text-sm text-slate-700">Output: {example.output}</pre>
                </>
              )}
              {example.explanation && <p className="mt-3 text-sm text-slate-600">{example.explanation}</p>}
            </div>
          ))}
        </div>
      );
    }

    if (activeTab === "constraints") {
      return (
        <div className="rounded-[24px] border border-blue-100 bg-blue-50/60 p-4 text-sm leading-7 text-slate-700">
          {question.constraints || "No constraints provided."}
        </div>
      );
    }

    if (activeTab === "submissions") {
      return (
        <div className="space-y-4 text-sm text-slate-600">
          <div className="rounded-[24px] border border-blue-100 bg-blue-50/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-600">Status</p>
            <p className="mt-2 text-base font-bold text-slate-900">{statusMessage}</p>
          </div>
          {submissionSummary ? (
            <div className="rounded-[24px] border border-teal-100 bg-teal-50/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-teal-700">Latest Submission</p>
              <p className="mt-2 text-base font-bold text-slate-900">
                Passed {submissionSummary.passed} of {submissionSummary.total} tests
              </p>
            </div>
          ) : (
            <p>No submissions yet. Run or submit code to populate this section.</p>
          )}
        </div>
      );
    }

    if (activeTab === "solutions") {
      if (!canViewSolutions) {
        return (
          <div className="rounded-[24px] border border-teal-100 bg-teal-50/70 p-4 text-sm text-slate-600">
            Solutions unlock only after you pass every visible and hidden test case for this question.
          </div>
        );
      }
      if ((question.solutions || []).length === 0) {
        return <p className="text-sm text-slate-500">No solutions published yet.</p>;
      }
      const visibleSolutions = solutionsByLanguage[solutionLanguage] || [];
      return (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-600">Solution Language</p>
            <select
              value={solutionLanguage}
              onChange={(event) => setSolutionLanguage(event.target.value)}
              className="rounded-full border border-blue-100 bg-white px-4 py-2 text-sm font-semibold text-slate-700 outline-none"
            >
              {availableSolutionLanguages.map((item) => (
                <option key={item} value={item}>
                  {LANGUAGES.find((languageOption) => languageOption.id === item)?.label || item}
                </option>
              ))}
            </select>
          </div>
          {visibleSolutions.map((solution) => (
            <div key={solution.id} className="rounded-[24px] border border-blue-100 bg-blue-50/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-600">
                {String(solution.approach_type || "solution").replace("_", " ")}
              </p>
              <pre className="mt-3 overflow-auto whitespace-pre-wrap rounded-2xl bg-white p-4 text-sm text-slate-800">
                {solution.code}
              </pre>
              <p className="mt-3 text-sm text-slate-600">{solution.explanation}</p>
            </div>
          ))}
          {visibleSolutions.length === 0 && (
            <p className="text-sm text-slate-500">No solution is available for this language yet.</p>
          )}
        </div>
      );
    }

    return null;
  };

  if (loading) {
    return (
      <div className="erp-card rounded-[32px] px-6 py-20 text-center text-sm text-slate-500">
        Loading practice arena...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-[32px] border border-red-200 bg-red-50 px-6 py-8 text-sm text-red-600">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="erp-card erp-grid-bg overflow-hidden rounded-[28px] px-5 py-6 md:px-7">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.45em] text-blue-600">Practice Arena</p>
            <h1 className="mt-3 text-2xl font-extrabold text-slate-900 md:text-3xl">{question?.title}</h1>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span
                className={`rounded-full border px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.24em] ${
                  difficultyStyles[difficulty] || "border-blue-200 bg-blue-50 text-blue-700"
                }`}
              >
                {difficulty}
              </span>
              {(question?.tags || []).map((item) => (
                <span key={item} className="rounded-full border border-blue-100 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600">
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => navigate("/practice")}
              className="rounded-full border border-blue-100 bg-white px-4 py-2 text-sm font-semibold text-blue-700"
            >
              Question Bank
            </button>
            {isPrivileged && (
              <button
                onClick={() => navigate("/practice-arena-admin")}
                className="rounded-full border border-teal-200 bg-teal-50 px-4 py-2 text-sm font-semibold text-teal-700"
              >
                Edit Question
              </button>
            )}
            {!notesDisabledForStudent && (
              <button
                onClick={() => setNotesOpen(true)}
                className="rounded-full border border-blue-100 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
              >
                Notes
              </button>
            )}
            <button
              onClick={() => setSettingsOpen(true)}
              className="rounded-full border border-blue-100 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
            >
              Settings
            </button>
            <span className="rounded-full border border-blue-100 bg-white px-4 py-2 text-sm font-bold text-blue-700">
              {formatTimer(timerSeconds)}
            </span>
            <button
              onClick={() => setTimerSeconds(0)}
              className="rounded-full border border-blue-100 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
            >
              Reset Timer
            </button>
            <span className="rounded-full border border-teal-200 bg-teal-50 px-4 py-2 text-sm font-bold text-teal-700">
              Streak {streak}
            </span>
            <span
              className={`rounded-full border px-4 py-2 text-sm font-bold ${
                copyPasteLocked
                  ? "border-rose-200 bg-rose-50 text-rose-700"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700"
              }`}
            >
              {copyPasteLocked ? "Proctored Mode On" : "Copy/Paste Allowed"}
            </span>
            <button
              onClick={handleSaveCode}
              className="rounded-full bg-gradient-to-r from-blue-600 to-teal-500 px-5 py-2 text-sm font-bold text-white shadow-lg shadow-blue-100"
            >
              Save Code
            </button>
          </div>
        </div>

        {saveNotice && <p className="mt-4 text-sm font-semibold text-blue-600">{saveNotice}</p>}

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-[20px] border border-blue-100 bg-white/90 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-600">Attempts</p>
            <p className="mt-2 text-lg font-extrabold text-slate-900">{progress.attempts || 0}</p>
          </div>
          <div className="rounded-[20px] border border-teal-100 bg-white/90 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-teal-700">Runs</p>
            <p className="mt-2 text-lg font-extrabold text-slate-900">{progress.runs || 0}</p>
          </div>
          <div className="rounded-[20px] border border-slate-200 bg-white/90 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Last Attempt</p>
            <p className="mt-2 text-sm font-semibold text-slate-700">{formatRelativeTime(progress.lastAttemptAt || progress.lastRunAt)}</p>
          </div>
        </div>
      </section>

      <section ref={containerRef} className="flex min-h-[72vh] flex-col gap-4 overflow-hidden lg:flex-row">
        <div
          className={`erp-card flex min-h-[72vh] min-w-0 flex-col overflow-hidden rounded-[28px] p-4 ${selectionLocked ? "select-none" : ""}`}
          style={{ flex: split }}
          onCopyCapture={(event) => blockProtectedAction(event, "Copy")}
          onCutCapture={(event) => blockProtectedAction(event, "Cut")}
          onPasteCapture={(event) => blockProtectedAction(event, "Paste")}
          onContextMenuCapture={(event) => blockProtectedAction(event, "Context menu")}
          onDragStartCapture={(event) => blockProtectedAction(event, "Drag")}
        >
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#e6efff] px-3 pb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-blue-600">Problem Details</p>
              <h2 className="mt-2 text-xl font-extrabold text-slate-900 md:text-2xl">
                {question?.short_description || question?.title}
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-blue-700">
                {statusMessage}
              </span>
              <span className="rounded-full border border-teal-100 bg-teal-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-teal-700">
                {isSqlQuestion
                  ? `${submissionSummary?.passed || 0}/${submissionSummary?.total || 0} accepted`
                  : `${visibleResults.filter((item) => item.passed).length}/${visibleResults.length} visible passed`}
              </span>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 px-2">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  if (tab.id === "solutions" && !canViewSolutions) return;
                  setActiveTab(tab.id);
                }}
                disabled={tab.id === "solutions" && !canViewSolutions}
                className={[
                  "rounded-full px-3 py-2 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-55 md:px-4 md:text-sm",
                  activeTab === tab.id
                    ? "bg-gradient-to-r from-blue-600 to-teal-500 text-white shadow-lg shadow-blue-100"
                    : "border border-blue-100 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-700",
                ].join(" ")}
              >
                {tab.id === "solutions" && !canViewSolutions ? "Solutions Locked" : tab.label}
              </button>
            ))}
          </div>

          <div className="erp-scrollbar mt-4 min-h-0 flex-1 overflow-auto rounded-[24px] border border-[#e6efff] bg-white p-4 md:p-5">
            {renderTabContent()}
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[20px] border border-blue-100 bg-blue-50/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-600">Points</p>
              <p className="mt-2 text-xl font-extrabold text-slate-900">{question?.points || 0}</p>
            </div>
            <div className="rounded-[20px] border border-blue-100 bg-blue-50/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-600">Time Limit</p>
              <p className="mt-2 text-xl font-extrabold text-slate-900">{question?.time_limit || 1}s</p>
            </div>
            <div className="rounded-[20px] border border-teal-100 bg-teal-50/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-teal-700">Memory</p>
              <p className="mt-2 text-xl font-extrabold text-slate-900">{question?.memory_limit || 256} MB</p>
            </div>
            <div className="rounded-[20px] border border-teal-100 bg-teal-50/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-teal-700">
                {isSqlQuestion ? "Accepted Solutions" : "Test Cases"}
              </p>
              <p className="mt-2 text-xl font-extrabold text-slate-900">
                {isSqlQuestion
                  ? (question?.solutions?.filter((item) => normalizeLanguage(item.language) === "sql").length || 0)
                  : (question?.test_cases?.length || 0)}
              </p>
            </div>
          </div>
        </div>

        <div
          onMouseDown={() => setIsResizing(true)}
          className="erp-pulse-border hidden w-2 cursor-col-resize rounded-full bg-gradient-to-b from-blue-200 to-teal-200 lg:block"
        />

        <div className="erp-card flex min-h-[72vh] min-w-0 flex-col overflow-hidden rounded-[28px] p-4" style={{ flex: 1 - split }}>
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#e6efff] px-2 pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-blue-600">Code Editor</p>
                <h2 className="mt-2 text-xl font-extrabold text-slate-900 md:text-2xl">
                  {isSqlQuestion ? "Write your SQL query" : "Write your solution"}
                </h2>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={language}
                  onChange={(event) => setLanguage(event.target.value)}
                  className="rounded-full border border-blue-100 bg-white px-4 py-2 text-sm font-semibold text-slate-700 outline-none"
                >
                  {(isSqlQuestion
                    ? LANGUAGES.filter((item) => item.id === "sql")
                    : LANGUAGES.filter((item) => item.id !== "sql")).map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              <button
                onClick={handleResetCode}
                className="rounded-full border border-blue-100 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
              >
                Reset Code
              </button>
            </div>
          </div>

          <div
            className="mt-4 overflow-hidden rounded-[24px] border border-[#d8e6ff] bg-white"
            onCopyCapture={(event) => blockProtectedAction(event, "Copy")}
            onCutCapture={(event) => blockProtectedAction(event, "Cut")}
            onPasteCapture={(event) => blockProtectedAction(event, "Paste")}
            onContextMenuCapture={(event) => blockProtectedAction(event, "Context menu")}
          >
            <Editor
              height="360px"
              language={language === "cpp" ? "cpp" : language}
              theme="vs"
              value={code}
              onChange={(value = "") => {
                hasDraftChangesRef.current = true;
                setCode(value);
              }}
              options={{
                minimap: { enabled: false },
                fontSize,
                tabSize,
                smoothScrolling: true,
                scrollBeyondLastLine: false,
                padding: { top: 18, bottom: 18 },
                fontFamily: "'JetBrains Mono', monospace",
                wordWrap: isSqlQuestion ? "on" : "off",
                contextmenu: !proctorModeActive,
                selectionClipboard: !proctorModeActive,
              }}
            />
          </div>

          <div className="mt-4 rounded-[24px] border border-[#d8e6ff] bg-[#fbfdff] p-4">
            {isSqlQuestion ? (
              <div className="space-y-4">
                <div className="rounded-[20px] border border-blue-100 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-600">Practice Data Tables</p>
                  <div className="mt-3">
                    <SqlSampleTablesPanel tables={displaySampleTables} />
                  </div>
                </div>
                <div className="rounded-[20px] border border-teal-100 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.25em] text-teal-700">Expected Output</p>
                  <div className="mt-3">
                    <SqlResultTable title="Expected Output" value={question?.expected_output || "No expected output provided."} tone="teal" />
                  </div>
                </div>
              </div>
            ) : (
              <>
                <label className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-600">Custom Input</label>
                <textarea
                  value={customInput}
                  onChange={(event) => setCustomInput(event.target.value)}
                  placeholder="nums = [1, 2, 3, 4]"
                  className="mt-3 h-24 w-full rounded-2xl border border-blue-100 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-blue-300"
                />
              </>
            )}

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                onClick={handleRun}
                disabled={isRunning}
                className="rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isRunning ? "Running..." : isSqlQuestion ? "Run Query" : "Run Code"}
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="rounded-2xl bg-gradient-to-r from-teal-600 to-teal-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-teal-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "Submitting..." : isSqlQuestion ? "Submit Query" : "Submit"}
              </button>
            </div>
          </div>

          <div className="mt-4 min-h-0 flex-1 overflow-hidden rounded-[24px] border border-[#d8e6ff] bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#edf4ff] pb-4">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setConsoleTab("output")}
                  className={[
                    "rounded-full px-4 py-2 text-sm font-bold transition",
                    consoleTab === "output"
                      ? "bg-blue-600 text-white"
                      : "border border-blue-100 bg-blue-50 text-blue-700",
                  ].join(" ")}
                >
                  {isSqlQuestion ? "Query Output" : "Output"}
                </button>
                <button
                  onClick={() => setConsoleTab("tests")}
                  className={[
                    "rounded-full px-4 py-2 text-sm font-bold transition",
                    consoleTab === "tests"
                      ? "bg-teal-600 text-white"
                      : "border border-teal-100 bg-teal-50 text-teal-700",
                  ].join(" ")}
                >
                  Test Results
                </button>
              </div>

              {submissionSummary && (
                <p className="text-sm font-semibold text-slate-600">
                  {submissionSummary.passed}/{submissionSummary.total} tests passed
                </p>
              )}
            </div>

            {consoleTab === "output" ? (
              isSqlQuestion ? (
                <div className="erp-scrollbar mt-4 max-h-72 overflow-auto">
                  <SqlResultTable title="Query Result" value={consoleOutput} tone="blue" />
                </div>
              ) : (
                <pre className="erp-scrollbar mt-4 max-h-72 overflow-auto whitespace-pre-wrap rounded-[20px] bg-[#f7faff] p-4 text-sm text-slate-700">
                  {consoleOutput}
                </pre>
              )
            ) : (
              <div className="erp-scrollbar mt-4 max-h-72 space-y-3 overflow-auto">
                {visibleResults.length === 0 && hiddenResults.length === 0 ? (
                  <div className="rounded-[24px] border border-dashed border-blue-200 px-4 py-8 text-sm text-slate-500">
                    {isSqlQuestion ? "Submit the SQL query to validate it against the accepted answers." : "Submit code to see the test breakdown."}
                  </div>
                ) : (
                  <>
                    {visibleResults.map((item) => (
                      <div key={item.id} className="rounded-[24px] border border-blue-100 bg-blue-50/60 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-bold text-slate-900">Visible Case {item.id}</p>
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] ${
                              item.passed ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                            }`}
                          >
                            {item.passed ? "Passed" : "Failed"}
                          </span>
                        </div>
                        {isSqlQuestion ? (
                          <div className="mt-3 grid gap-3">
                            <SqlResultTable title="Expected" value={item.expected_output || "(empty)"} tone="teal" />
                            <SqlResultTable title="Actual" value={item.actual_output || "(no output)"} tone="blue" />
                          </div>
                        ) : (
                          <>
                            <p className="mt-3 text-sm text-slate-600">Expected: {item.expected_output || "(empty)"}</p>
                            <p className="mt-2 text-sm text-slate-600">Actual: {item.actual_output || "(no output)"}</p>
                          </>
                        )}
                      </div>
                    ))}

                    {hiddenResults.length > 0 && (
                      <div className="rounded-[24px] border border-teal-100 bg-teal-50/70 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-teal-700">Hidden Cases</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {hiddenResults.map((item) => (
                            <span
                              key={item.id}
                              className={`rounded-full px-3 py-2 text-xs font-bold ${
                                item.passed ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                              }`}
                            >
                              Hidden {item.id}: {item.passed ? "Passed" : "Failed"}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {notesOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/25 px-4">
          <div className="erp-card w-full max-w-2xl rounded-[32px] p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-blue-600">Notes</p>
                <h3 className="mt-2 text-2xl font-extrabold text-slate-900">Private workspace notes</h3>
              </div>
              <button
                onClick={() => setNotesOpen(false)}
                className="rounded-full border border-blue-100 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
              >
                Close
              </button>
            </div>
            <textarea
              value={notesContent}
              onChange={(event) => {
                hasDraftChangesRef.current = true;
                setNotesContent(event.target.value);
              }}
              className="mt-5 h-72 w-full rounded-[24px] border border-[#d8e6ff] bg-[#fbfdff] px-4 py-4 text-sm text-slate-700 outline-none transition focus:border-blue-300"
              placeholder="Write your thought process, edge cases, or reminders here..."
            />
            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={() => {
                  hasDraftChangesRef.current = true;
                  setNotesContent("");
                }}
                className="rounded-full border border-teal-100 bg-teal-50 px-4 py-2 text-sm font-semibold text-teal-700"
              >
                Clear
              </button>
              <button
                onClick={handleSaveNotes}
                className="rounded-full bg-gradient-to-r from-blue-600 to-teal-500 px-5 py-2 text-sm font-bold text-white"
              >
                Save Notes
              </button>
            </div>
          </div>
        </div>
      )}

      {settingsOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/25 px-4">
          <div className="erp-card w-full max-w-3xl rounded-[32px] p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-teal-700">Settings</p>
                <h3 className="mt-2 text-2xl font-extrabold text-slate-900">Editor preferences</h3>
              </div>
              <button
                onClick={() => setSettingsOpen(false)}
                className="rounded-full border border-blue-100 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
              >
                Close
              </button>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-[24px] border border-blue-100 bg-blue-50/60 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-600">Font Size</p>
                <input
                  type="range"
                  min="12"
                  max="20"
                  value={fontSize}
                  onChange={(event) => setFontSize(Number(event.target.value))}
                  className="mt-4 w-full"
                />
                <p className="mt-2 text-sm font-semibold text-slate-700">{fontSize}px</p>
              </div>

              <div className="rounded-[24px] border border-teal-100 bg-teal-50/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-teal-700">Tab Size</p>
                <input
                  type="range"
                  min="2"
                  max="6"
                  value={tabSize}
                  onChange={(event) => setTabSize(Number(event.target.value))}
                  className="mt-4 w-full"
                />
                <p className="mt-2 text-sm font-semibold text-slate-700">{tabSize} spaces</p>
              </div>
            </div>

            {isPrivileged && (
              <div className="mt-4 rounded-[24px] border border-rose-100 bg-rose-50/70 p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.25em] text-rose-700">Proctored Copy Controls</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      When enabled, students cannot copy, cut, paste, use paste special, open the context menu, or use common clipboard shortcuts inside the question workspace.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCopyPasteLocked((current) => !current)}
                    className={`rounded-full px-4 py-2 text-sm font-bold ${
                      copyPasteLocked
                        ? "border border-rose-200 bg-white text-rose-700"
                        : "border border-emerald-200 bg-white text-emerald-700"
                    }`}
                  >
                    {copyPasteLocked ? "Disable Student Copy/Paste" : "Enable Student Copy/Paste"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {proctorSettings.watermarkEnabled && !isPrivileged && question && (
        <div className="pointer-events-none fixed inset-0 z-10 overflow-hidden">
          <div className="absolute inset-0 opacity-[0.06] [background-size:260px_160px] [background-image:radial-gradient(circle_at_center,transparent_0,transparent_38%,rgba(15,23,42,0.95)_39%,transparent_40%)]" />
          <div className="absolute inset-0 flex flex-wrap content-start gap-16 p-10 text-[22px] font-bold uppercase tracking-[0.35em] text-slate-900/10">
            {Array.from({ length: 12 }).map((_, index) => (
              <span key={index}>
                {user?.name || "Student"} · {user?.role || "student"}
              </span>
            ))}
          </div>
        </div>
      )}

      {guardOverlayOpen && !isPrivileged && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm">
          <div className="erp-card w-full max-w-2xl rounded-[32px] p-8 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.4em] text-rose-600">Protected Workspace</p>
            <h3 className="mt-3 text-3xl font-extrabold text-slate-900">Practice Arena paused</h3>
            <p className="mt-4 text-sm leading-7 text-slate-600">
              We detected a focus change while proctor guard is active. Return to the workspace and resume only when you are ready to continue inside the monitored session.
            </p>
            <div className="mt-5 rounded-[24px] border border-blue-100 bg-blue-50/70 p-4 text-left text-sm text-slate-700">
              <p className="font-semibold text-slate-900">Current protection rules</p>
              <ul className="mt-3 space-y-2">
                {copyPasteLocked && <li>- Student copy, cut, paste, and paste special are disabled.</li>}
                {proctorSettings.blurOnFocusLoss && <li>- Tab switches and window blur trigger the guard overlay.</li>}
                {proctorSettings.requireFullscreen && <li>- Fullscreen is required before resuming.</li>}
              </ul>
            </div>
            <div className="mt-6 flex justify-center gap-3">
              <button
                type="button"
                onClick={handleResumeGuardedWorkspace}
                className="rounded-full bg-gradient-to-r from-blue-600 to-teal-500 px-6 py-3 text-sm font-bold text-white"
              >
                Resume workspace
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PracticeArena;
