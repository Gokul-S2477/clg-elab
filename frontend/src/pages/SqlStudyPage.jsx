import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  SQL_STUDY_COURSE,
  getNextSqlTopicId,
  getPreviousSqlTopicId,
  getSqlModuleById,
  getSqlTopicById,
  getTopicContent,
} from "../data/sqlStudyCourse";
import { getStoredUser } from "../utils/roleHelper";
import { getSqlCompletionPercent, markSqlTopicVisited, readSqlStudyProgress } from "../utils/sqlStudyProgress";

const normalize = (value = "") => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const TopicReference = ({ topic, moduleReferenceLines }) => {
  const matches = useMemo(() => {
    const keywords = [topic.title, ...(topic.subtopics || [])]
      .flatMap((item) => normalize(item).split(" "))
      .filter((item) => item.length > 2);

    const filtered = moduleReferenceLines.filter((line) => {
      const current = normalize(line);
      return keywords.some((keyword) => current.includes(keyword));
    });

    return filtered.slice(0, 80);
  }, [moduleReferenceLines, topic]);

  if (!matches.length) {
    return null;
  }

  return (
    <details className="rounded-[24px] border border-slate-200 bg-slate-50">
      <summary className="cursor-pointer list-none px-5 py-4 text-sm font-bold text-slate-900">
        Related notes from your file
      </summary>
      <div className="border-t border-slate-200 px-5 py-4">
        <div className="space-y-3">
          {matches.map((line, index) => (
            <p key={`${topic.id}-ref-${index}`} className="text-sm leading-7 text-slate-700">
              {line}
            </p>
          ))}
        </div>
      </div>
    </details>
  );
};

const ModuleReference = ({ moduleItem }) => (
  <details className="rounded-[24px] border border-slate-200 bg-slate-50">
    <summary className="cursor-pointer list-none px-5 py-4 text-sm font-bold text-slate-900">
      Complete imported notes for {moduleItem.title}
    </summary>
    <div className="border-t border-slate-200 px-5 py-4">
      <div className="space-y-3">
        {moduleItem.referenceLines.map((line, index) => (
          <p key={`${moduleItem.id}-line-${index}`} className="text-sm leading-7 text-slate-700">
            {line}
          </p>
        ))}
      </div>
    </div>
  </details>
);

const SectionCard = ({ title, children }) => (
  <section className="rounded-[26px] border border-slate-200 bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
    <h2 className="text-2xl font-semibold text-slate-950">{title}</h2>
    <div className="mt-4 space-y-4">{children}</div>
  </section>
);

const ExampleTable = ({ table }) => (
  <div className="overflow-hidden rounded-[22px] border border-slate-200 bg-white">
    <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900">{table.name}</div>
    <div className="overflow-auto">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-white">
          <tr>
            {table.headers.map((header) => (
              <th key={`${table.name}-${header}`} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {table.rows.map((row, rowIndex) => (
            <tr key={`${table.name}-${rowIndex}`}>
              {row.map((cell, cellIndex) => (
                <td key={`${table.name}-${rowIndex}-${cellIndex}`} className="px-4 py-3 text-slate-700">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const FlowDiagram = ({ diagram }) => (
  <div className="rounded-[22px] border border-slate-200 bg-gradient-to-br from-slate-50 to-blue-50 px-4 py-5">
    <p className="text-sm font-bold text-slate-900">{diagram.title}</p>
    <div className="mt-4 flex flex-wrap items-center gap-3">
      {diagram.nodes.map((node, index) => (
        <React.Fragment key={`${diagram.title}-${node}-${index}`}>
          <div className="rounded-2xl border border-blue-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm">
            {node}
          </div>
          {index < diagram.nodes.length - 1 ? <span className="text-lg font-bold text-blue-600">→</span> : null}
        </React.Fragment>
      ))}
    </div>
    <p className="mt-4 text-sm leading-7 text-slate-700">{diagram.caption}</p>
  </div>
);

const DedicatedSqlDiagram = ({ type, topicId, topicTitle }) => {
  if (type === "join") {
    if (topicId === "inner-join" || topicId === "left-join" || topicId === "right-join" || topicId === "full-join") {
      const fillLeft = topicId === "left-join" || topicId === "full-join" ? "#93c5fd" : "#eff6ff";
      const fillRight = topicId === "right-join" || topicId === "full-join" ? "#93c5fd" : "#eff6ff";
      return (
        <svg viewBox="0 0 760 280" className="w-full rounded-[22px] border border-slate-200 bg-white p-4">
          <text x="40" y="40" fontSize="24" fontWeight="700" fill="#0f172a">{topicTitle} Venn Diagram</text>
          <circle cx="300" cy="150" r="95" fill={fillLeft} fillOpacity="0.85" stroke="#2563eb" strokeWidth="3" />
          <circle cx="420" cy="150" r="95" fill={fillRight} fillOpacity="0.85" stroke="#2563eb" strokeWidth="3" />
          <path d="M360,63 A95,95 0 0,1 360,237 A95,95 0 0,1 360,63 Z" fill="#2563eb" fillOpacity={topicId === "full-join" ? "0.72" : "0.94"} />
          <text x="215" y="150" fontSize="18" fontWeight="700" fill="#0f172a">Left</text>
          <text x="455" y="150" fontSize="18" fontWeight="700" fill="#0f172a">Right</text>
          <text x="336" y="150" fontSize="18" fontWeight="700" fill="#ffffff">Match</text>
          <text x="40" y="255" fontSize="15" fill="#334155">
            {topicId === "inner-join" && "INNER JOIN keeps only the overlap."}
            {topicId === "left-join" && "LEFT JOIN keeps all left rows plus matches."}
            {topicId === "right-join" && "RIGHT JOIN keeps all right rows plus matches."}
            {topicId === "full-join" && "FULL JOIN keeps both unmatched sides and the overlap."}
          </text>
        </svg>
      );
    }
    if (topicId === "cross-join") {
      return (
        <svg viewBox="0 0 760 280" className="w-full rounded-[22px] border border-slate-200 bg-white p-4">
          <text x="40" y="40" fontSize="24" fontWeight="700" fill="#0f172a">CROSS JOIN Combination Grid</text>
          <rect x="60" y="80" width="180" height="140" rx="14" fill="#eff6ff" stroke="#93c5fd" strokeWidth="2" />
          <rect x="520" y="80" width="180" height="140" rx="14" fill="#eff6ff" stroke="#93c5fd" strokeWidth="2" />
          <rect x="295" y="80" width="170" height="140" rx="14" fill="#dbeafe" stroke="#60a5fa" strokeWidth="2" />
          <text x="90" y="115" fontSize="18" fontWeight="700" fill="#0f172a">colors</text>
          <text x="90" y="145" fontSize="15" fill="#334155">Red</text>
          <text x="90" y="170" fontSize="15" fill="#334155">Blue</text>
          <text x="550" y="115" fontSize="18" fontWeight="700" fill="#0f172a">sizes</text>
          <text x="550" y="145" fontSize="15" fill="#334155">S</text>
          <text x="550" y="170" fontSize="15" fill="#334155">M</text>
          <text x="320" y="115" fontSize="18" fontWeight="700" fill="#0f172a">result</text>
          <text x="320" y="145" fontSize="15" fill="#334155">Red-S</text>
          <text x="320" y="170" fontSize="15" fill="#334155">Red-M</text>
          <text x="320" y="195" fontSize="15" fill="#334155">Blue-S / Blue-M</text>
        </svg>
      );
    }
    if (topicId === "self-join") {
      return (
        <svg viewBox="0 0 760 280" className="w-full rounded-[22px] border border-slate-200 bg-white p-4">
          <text x="40" y="40" fontSize="24" fontWeight="700" fill="#0f172a">SELF JOIN Hierarchy Diagram</text>
          <rect x="100" y="80" width="220" height="140" rx="16" fill="#eff6ff" stroke="#93c5fd" strokeWidth="2" />
          <rect x="440" y="80" width="220" height="140" rx="16" fill="#eff6ff" stroke="#93c5fd" strokeWidth="2" />
          <text x="130" y="115" fontSize="20" fontWeight="700" fill="#0f172a">employees e</text>
          <text x="130" y="145" fontSize="15" fill="#334155">employee_id</text>
          <text x="130" y="170" fontSize="15" fill="#334155">manager_id</text>
          <text x="470" y="115" fontSize="20" fontWeight="700" fill="#0f172a">employees m</text>
          <text x="470" y="145" fontSize="15" fill="#334155">employee_id</text>
          <text x="470" y="170" fontSize="15" fill="#334155">employee_name</text>
          <line x1="320" y1="165" x2="440" y2="145" stroke="#2563eb" strokeWidth="4" />
          <text x="330" y="125" fontSize="14" fontWeight="700" fill="#2563eb">e.manager_id = m.employee_id</text>
        </svg>
      );
    }
    if (topicId === "join-vs-where") {
      return (
        <svg viewBox="0 0 760 280" className="w-full rounded-[22px] border border-slate-200 bg-white p-4">
          <text x="40" y="40" fontSize="24" fontWeight="700" fill="#0f172a">JOIN vs WHERE Diagram</text>
          <rect x="60" y="80" width="280" height="150" rx="16" fill="#eff6ff" stroke="#93c5fd" strokeWidth="2" />
          <rect x="420" y="80" width="280" height="150" rx="16" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="2" />
          <text x="90" y="115" fontSize="20" fontWeight="700" fill="#0f172a">JOIN</text>
          <text x="90" y="145" fontSize="15" fill="#334155">Combines rows from different tables</text>
          <text x="90" y="170" fontSize="15" fill="#334155">Uses ON to define the row match</text>
          <text x="450" y="115" fontSize="20" fontWeight="700" fill="#0f172a">WHERE</text>
          <text x="450" y="145" fontSize="15" fill="#334155">Filters rows after FROM/JOIN</text>
          <text x="450" y="170" fontSize="15" fill="#334155">Uses conditions like salary &gt; 50000</text>
        </svg>
      );
    }
    if (topicId === "join-internals") {
      return (
        <svg viewBox="0 0 760 280" className="w-full rounded-[22px] border border-slate-200 bg-white p-4">
          <text x="40" y="40" fontSize="24" fontWeight="700" fill="#0f172a">Join Internals Diagram</text>
          <rect x="40" y="90" width="190" height="120" rx="16" fill="#eff6ff" stroke="#93c5fd" strokeWidth="2" />
          <rect x="285" y="90" width="190" height="120" rx="16" fill="#eff6ff" stroke="#93c5fd" strokeWidth="2" />
          <rect x="530" y="90" width="190" height="120" rx="16" fill="#eff6ff" stroke="#93c5fd" strokeWidth="2" />
          <text x="70" y="125" fontSize="18" fontWeight="700" fill="#0f172a">Nested Loop</text>
          <text x="70" y="155" fontSize="14" fill="#334155">Good for small outer input</text>
          <text x="313" y="125" fontSize="18" fontWeight="700" fill="#0f172a">Hash Join</text>
          <text x="313" y="155" fontSize="14" fill="#334155">Good for equality matching</text>
          <text x="557" y="125" fontSize="18" fontWeight="700" fill="#0f172a">Merge Join</text>
          <text x="557" y="155" fontSize="14" fill="#334155">Good for sorted inputs</text>
        </svg>
      );
    }
    return (
      <svg viewBox="0 0 760 260" className="w-full rounded-[22px] border border-slate-200 bg-white p-4">
        <rect x="40" y="40" width="220" height="150" rx="16" fill="#eff6ff" stroke="#93c5fd" strokeWidth="2" />
        <rect x="500" y="40" width="220" height="150" rx="16" fill="#eff6ff" stroke="#93c5fd" strokeWidth="2" />
        <text x="70" y="72" fontSize="20" fontWeight="700" fill="#0f172a">customers</text>
        <text x="70" y="110" fontSize="16" fill="#334155">customer_id</text>
        <text x="70" y="138" fontSize="16" fill="#334155">customer_name</text>
        <text x="530" y="72" fontSize="20" fontWeight="700" fill="#0f172a">orders</text>
        <text x="530" y="110" fontSize="16" fill="#334155">order_id</text>
        <text x="530" y="138" fontSize="16" fill="#334155">customer_id</text>
        <line x1="260" y1="110" x2="500" y2="110" stroke="#2563eb" strokeWidth="4" />
        <polygon points="500,110 485,102 485,118" fill="#2563eb" />
        <text x="305" y="95" fontSize="16" fontWeight="700" fill="#2563eb">JOIN ON customer_id</text>
      </svg>
    );
  }
  if (type === "group-by" || type === "having") {
    return (
      <svg viewBox="0 0 760 260" className="w-full rounded-[22px] border border-slate-200 bg-white p-4">
        <rect x="30" y="40" width="180" height="160" rx="16" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="2" />
        <rect x="290" y="40" width="180" height="160" rx="16" fill="#eff6ff" stroke="#93c5fd" strokeWidth="2" />
        <rect x="550" y="40" width="180" height="160" rx="16" fill="#dbeafe" stroke="#60a5fa" strokeWidth="2" />
        <text x="70" y="72" fontSize="20" fontWeight="700" fill="#0f172a">Raw Rows</text>
        <text x="60" y="108" fontSize="15" fill="#334155">IT 50000</text>
        <text x="60" y="134" fontSize="15" fill="#334155">IT 65000</text>
        <text x="60" y="160" fontSize="15" fill="#334155">HR 42000</text>
        <text x="327" y="72" fontSize="20" fontWeight="700" fill="#0f172a">Grouped</text>
        <text x="320" y="118" fontSize="15" fill="#334155">IT → 2 rows</text>
        <text x="320" y="144" fontSize="15" fill="#334155">HR → 1 row</text>
        <text x="577" y="72" fontSize="20" fontWeight="700" fill="#0f172a">Summary</text>
        <text x="575" y="118" fontSize="15" fill="#334155">IT | COUNT 2</text>
        <text x="575" y="144" fontSize="15" fill="#334155">HR | COUNT 1</text>
        <line x1="210" y1="120" x2="290" y2="120" stroke="#2563eb" strokeWidth="4" />
        <line x1="470" y1="120" x2="550" y2="120" stroke="#2563eb" strokeWidth="4" />
      </svg>
    );
  }
  if (type === "subquery") {
    return (
      <svg viewBox="0 0 760 260" className="w-full rounded-[22px] border border-slate-200 bg-white p-4">
        <rect x="50" y="40" width="280" height="170" rx="16" fill="#eff6ff" stroke="#93c5fd" strokeWidth="2" />
        <rect x="430" y="70" width="260" height="110" rx="16" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="2" />
        <text x="80" y="78" fontSize="20" fontWeight="700" fill="#0f172a">Outer Query</text>
        <text x="80" y="120" fontSize="16" fill="#334155">SELECT employee_name</text>
        <text x="80" y="148" fontSize="16" fill="#334155">WHERE salary &gt; (subquery)</text>
        <text x="455" y="108" fontSize="20" fontWeight="700" fill="#0f172a">Inner Query</text>
        <text x="455" y="142" fontSize="16" fill="#334155">SELECT AVG(salary)</text>
        <line x1="330" y1="125" x2="430" y2="125" stroke="#2563eb" strokeWidth="4" />
        <polygon points="430,125 415,117 415,133" fill="#2563eb" />
      </svg>
    );
  }
  if (type === "window") {
    return (
      <svg viewBox="0 0 760 260" className="w-full rounded-[22px] border border-slate-200 bg-white p-4">
        <rect x="40" y="40" width="680" height="170" rx="18" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="2" />
        <text x="70" y="78" fontSize="20" fontWeight="700" fill="#0f172a">Window Function</text>
        <text x="70" y="116" fontSize="16" fill="#334155">Asha | 90000 | rank 1</text>
        <text x="70" y="144" fontSize="16" fill="#334155">Ravi | 82000 | rank 2</text>
        <text x="70" y="172" fontSize="16" fill="#334155">Meera | 75000 | rank 3</text>
        <rect x="365" y="98" width="290" height="90" rx="14" fill="#dbeafe" stroke="#60a5fa" strokeWidth="2" />
        <text x="390" y="128" fontSize="15" fontWeight="700" fill="#1d4ed8">OVER (ORDER BY salary DESC)</text>
        <text x="390" y="156" fontSize="15" fill="#334155">Rows stay visible; ranking is added</text>
      </svg>
    );
  }
  if (type === "normalization") {
    return (
      <svg viewBox="0 0 760 280" className="w-full rounded-[22px] border border-slate-200 bg-white p-4">
        <rect x="30" y="55" width="210" height="150" rx="16" fill="#fef3c7" stroke="#f59e0b" strokeWidth="2" />
        <rect x="300" y="35" width="180" height="100" rx="16" fill="#eff6ff" stroke="#93c5fd" strokeWidth="2" />
        <rect x="300" y="155" width="180" height="90" rx="16" fill="#eff6ff" stroke="#93c5fd" strokeWidth="2" />
        <rect x="540" y="95" width="180" height="100" rx="16" fill="#eff6ff" stroke="#93c5fd" strokeWidth="2" />
        <text x="55" y="88" fontSize="18" fontWeight="700" fill="#0f172a">Single Wide Table</text>
        <text x="55" y="120" fontSize="14" fill="#334155">customer, order, product...</text>
        <text x="330" y="68" fontSize="18" fontWeight="700" fill="#0f172a">customers</text>
        <text x="330" y="185" fontSize="18" fontWeight="700" fill="#0f172a">orders</text>
        <text x="570" y="128" fontSize="18" fontWeight="700" fill="#0f172a">order_items</text>
        <line x1="240" y1="130" x2="300" y2="85" stroke="#2563eb" strokeWidth="4" />
        <line x1="240" y1="130" x2="300" y2="190" stroke="#2563eb" strokeWidth="4" />
        <line x1="480" y1="200" x2="540" y2="145" stroke="#2563eb" strokeWidth="4" />
      </svg>
    );
  }
  return null;
};

const PremiumCallout = ({ title, items, tone = "blue" }) => {
  const palette =
    tone === "amber"
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : tone === "rose"
        ? "border-rose-200 bg-rose-50 text-rose-900"
        : "border-blue-200 bg-blue-50 text-blue-900";

  return (
    <div className={`rounded-[22px] border p-5 ${palette}`}>
      <p className="text-sm font-bold uppercase tracking-[0.18em]">{title}</p>
      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <div key={item} className="rounded-2xl bg-white/70 px-4 py-3 text-sm leading-7">
            {item}
          </div>
        ))}
      </div>
    </div>
  );
};

const SqlStudyPage = () => {
  const user = getStoredUser();
  const userKey = user?.name || user?.role || "guest";
  const [searchParams, setSearchParams] = useSearchParams();
  const progress = readSqlStudyProgress(userKey);
  const completion = getSqlCompletionPercent(progress);

  const requestedModuleId = searchParams.get("module") || SQL_STUDY_COURSE.modules[0].id;
  const requestedTopicId = searchParams.get("topic");
  const currentModule = getSqlModuleById(requestedModuleId);
  const currentTopic = requestedTopicId ? getSqlTopicById(requestedTopicId) : null;
  const content = currentTopic ? getTopicContent(currentTopic.id) : null;

  const [expandedModules, setExpandedModules] = useState(() =>
    Object.fromEntries(SQL_STUDY_COURSE.modules.map((module) => [module.id, module.id === currentModule.id]))
  );

  useEffect(() => {
    setExpandedModules((current) => ({ ...current, [currentModule.id]: true }));
  }, [currentModule.id]);

  useEffect(() => {
    if (currentTopic) {
      markSqlTopicVisited(userKey, currentTopic.id);
    }
  }, [currentTopic, userKey]);

  const previousTopicId = currentTopic ? getPreviousSqlTopicId(currentTopic.id) : null;
  const nextTopicId = currentTopic ? getNextSqlTopicId(currentTopic.id) : null;

  const openModule = (moduleId) => {
    setExpandedModules((current) => ({ ...current, [moduleId]: !current[moduleId] }));
    setSearchParams({ module: moduleId });
  };

  const openTopic = (moduleId, topicId) => {
    setExpandedModules((current) => ({ ...current, [moduleId]: true }));
    setSearchParams({ module: moduleId, topic: topicId });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openNeighborTopic = (topicId) => {
    const target = getSqlTopicById(topicId);
    setSearchParams({ module: target.moduleId, topic: target.id });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[330px_minmax(0,1fr)]">
      <aside className="sticky top-[92px] h-[calc(100vh-110px)] overflow-hidden rounded-[30px] border border-slate-200 bg-[#eef2f5] shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
        <div className="border-b border-slate-200 bg-white px-5 py-5">
          <h2 className="text-[22px] font-semibold text-slate-950">{SQL_STUDY_COURSE.title}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">Module wise SQL study content with nested topics and detailed explanations.</p>
          <div className="mt-4 rounded-2xl bg-blue-50 px-4 py-3">
            <div className="flex items-center justify-between text-sm font-semibold text-slate-700">
              <span>Progress</span>
              <span>{completion}%</span>
            </div>
            <div className="mt-3 h-2 rounded-full bg-white">
              <div className="h-2 rounded-full bg-[#0F5BD8]" style={{ width: `${completion}%` }} />
            </div>
          </div>
        </div>

        <div className="erp-scrollbar h-[calc(100%-176px)] overflow-y-auto px-3 py-4">
          {SQL_STUDY_COURSE.modules.map((module) => {
            const moduleActive = currentModule.id === module.id && !currentTopic;
            const isExpanded = expandedModules[module.id];
            return (
              <div key={module.id} className="mb-3 overflow-hidden rounded-[24px] border border-slate-200 bg-white">
                <button
                  type="button"
                  onClick={() => openModule(module.id)}
                  className={`w-full px-4 py-4 text-left ${moduleActive ? "bg-[#0F5BD8] text-white" : "bg-white text-slate-900"}`}
                >
                  <p className={`text-xs font-semibold uppercase tracking-[0.24em] ${moduleActive ? "text-blue-50" : "text-slate-400"}`}>
                    Module {module.number}
                  </p>
                  <p className="mt-1 text-[15px] font-semibold leading-6">{module.title}</p>
                </button>

                {isExpanded ? (
                  <div className="border-t border-slate-200 bg-slate-50 px-3 py-3">
                    <div className="space-y-2">
                      {module.topics.map((moduleTopic) => {
                        const active = currentTopic?.id === moduleTopic.id;
                        return (
                          <button
                            key={moduleTopic.id}
                            type="button"
                            onClick={() => openTopic(module.id, moduleTopic.id)}
                            className={`w-full rounded-2xl px-3 py-3 text-left ${active ? "bg-[#0F5BD8] text-white" : "bg-white text-slate-700 hover:bg-blue-50"}`}
                          >
                            <p className="text-sm font-semibold">{moduleTopic.title}</p>
                            {moduleTopic.subtopics?.length ? (
                              <p className={`mt-1 text-xs leading-5 ${active ? "text-blue-50" : "text-slate-500"}`}>
                                {moduleTopic.subtopics.join(" | ")}
                              </p>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </aside>

      <div className="space-y-6">
        {!currentTopic ? (
          <>
            <section className="rounded-[30px] border border-slate-200 bg-white px-6 py-6 shadow-[0_18px_40px_rgba(15,23,42,0.06)] md:px-8">
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-blue-600">Module {currentModule.number}</p>
              <h1 className="mt-2 text-4xl font-semibold tracking-tight text-slate-950">{currentModule.title}</h1>
              <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-500">
                Open a topic from this module in the sidebar to view detailed explanation, syntax, multiple examples, internal working, performance notes, mistakes, interview questions, and practice prompts.
              </p>
            </section>

            <SectionCard title="Topics In This Module">
              <div className="grid gap-4 md:grid-cols-2">
                {currentModule.topics.map((moduleTopic) => (
                  <button
                    key={moduleTopic.id}
                    type="button"
                    onClick={() => openTopic(currentModule.id, moduleTopic.id)}
                    className="rounded-[22px] border border-slate-200 bg-slate-50 p-5 text-left hover:border-blue-300 hover:bg-blue-50"
                  >
                    <p className="text-lg font-semibold text-slate-900">{moduleTopic.title}</p>
                    {moduleTopic.subtopics?.length ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {moduleTopic.subtopics.map((item) => (
                          <span key={`${moduleTopic.id}-${item}`} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                            {item}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </button>
                ))}
              </div>
            </SectionCard>

            <ModuleReference moduleItem={currentModule} />
          </>
        ) : (
          <>
            <section className="rounded-[30px] border border-slate-200 bg-white px-6 py-6 shadow-[0_18px_40px_rgba(15,23,42,0.06)] md:px-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.32em] text-blue-600">
                    Module {currentTopic.moduleNumber}
                  </p>
                  <h1 className="mt-2 text-4xl font-semibold tracking-tight text-slate-950">{currentTopic.title}</h1>
                  <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-500">
                    {currentTopic.moduleTitle}
                  </p>
                </div>
                <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-4 text-right">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Topic Number</p>
                  <p className="mt-2 text-lg font-bold text-slate-900">{currentTopic.absoluteTopicNumber}</p>
                  <p className="mt-1 text-sm text-slate-500">{SQL_STUDY_COURSE.stats.items} total topics</p>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-6">
                <button
                  type="button"
                  onClick={() => previousTopicId && openNeighborTopic(previousTopicId)}
                  disabled={!previousTopicId}
                  className="rounded-xl bg-[#0F5BD8] px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => nextTopicId && openNeighborTopic(nextTopicId)}
                  disabled={!nextTopicId}
                  className="rounded-xl bg-[#0F5BD8] px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </section>

            {currentTopic.subtopics?.length ? (
              <SectionCard title="Subtopics">
                <div className="flex flex-wrap gap-2">
                  {currentTopic.subtopics.map((item) => (
                    <span key={`${currentTopic.id}-${item}`} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
                      {item}
                    </span>
                  ))}
                </div>
              </SectionCard>
            ) : null}

            <SectionCard title="Definition">
              {content.definition.map((item) => (
                <p key={item} className="text-[15px] leading-8 text-slate-700">
                  {item}
                </p>
              ))}
            </SectionCard>

            <SectionCard title="Syntax">
              <pre className="overflow-auto rounded-[22px] bg-slate-950 px-4 py-4 text-[13px] leading-6 text-emerald-100">
                <code>{content.syntax}</code>
              </pre>
            </SectionCard>

            <SectionCard title="Examples">
              {content.examples.map((example, index) => (
                <div key={`${currentTopic.id}-example-${index}`} className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                  <h3 className="text-lg font-bold text-slate-900">{example.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-slate-700">{example.description}</p>
                  <div className="mt-4 space-y-4">
                    <div>
                      <p className="mb-3 text-sm font-bold uppercase tracking-[0.18em] text-blue-700">{example.beforeQuery.title}</p>
                      <div className="space-y-3">
                        {example.beforeQuery.tables.map((table) => (
                          <ExampleTable key={`${currentTopic.id}-${example.title}-${table.name}`} table={table} />
                        ))}
                      </div>
                    </div>
                  </div>
                  <pre className="mt-4 overflow-auto rounded-[22px] bg-slate-950 px-4 py-4 text-[13px] leading-6 text-sky-100">
                    <code>{example.sql}</code>
                  </pre>
                  <div className="mt-4">
                    <PremiumCallout title="Step-By-Step" items={example.steps} tone="blue" />
                  </div>
                  <div className="mt-4">
                    <p className="mb-3 text-sm font-bold uppercase tracking-[0.18em] text-blue-700">{example.afterQuery.title}</p>
                    <ExampleTable table={example.afterQuery.table} />
                  </div>
                </div>
              ))}
            </SectionCard>

            <SectionCard title="Table Example">
              <p className="text-[15px] leading-8 text-slate-700">{content.tableExample.explanation}</p>
              <div className="space-y-4">
                {content.tableExample.tables.map((table) => (
                  <ExampleTable key={`${currentTopic.id}-${table.name}`} table={table} />
                ))}
              </div>
              <div>
                <p className="mb-3 text-sm font-bold uppercase tracking-[0.18em] text-blue-700">Result View</p>
                <ExampleTable table={content.tableExample.resultTable} />
              </div>
            </SectionCard>

            <SectionCard title="Expected Output">
              <p className="text-[15px] leading-8 text-slate-700">
                Students should compare their mental answer or written query against this expected result shape.
              </p>
              <ExampleTable table={content.expectedOutput} />
            </SectionCard>

            <SectionCard title="Visual Diagram">
              <div className="space-y-4">
                <DedicatedSqlDiagram type={content.diagram.type} topicId={currentTopic.id} topicTitle={currentTopic.title} />
                <FlowDiagram diagram={content.diagram} />
              </div>
            </SectionCard>

            <SectionCard title="Step-By-Step Explanation">
              <PremiumCallout title="How SQL Processes This Topic" items={content.stepByStep} tone="blue" />
            </SectionCard>

            {content.subtopicExamples?.length ? (
              <SectionCard title="Subtopic Visual Examples">
                {content.subtopicExamples.map((subtopic) => (
                  <div key={subtopic.id} className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                    <h3 className="text-lg font-bold text-slate-900">{subtopic.title}</h3>
                    <p className="mt-2 text-sm leading-7 text-slate-700">{subtopic.explanation}</p>
                    <pre className="mt-4 overflow-auto rounded-[22px] bg-slate-950 px-4 py-4 text-[13px] leading-6 text-sky-100">
                      <code>{subtopic.sql}</code>
                    </pre>
                    <div className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                      <ExampleTable table={{ name: `${subtopic.title} example`, ...subtopic.table }} />
                      <FlowDiagram diagram={{ title: `${subtopic.title} visual`, ...subtopic.visual }} />
                    </div>
                  </div>
                ))}
              </SectionCard>
            ) : null}

            <SectionCard title="Real-World Example">
              <p className="text-[15px] leading-8 text-slate-700">{content.realWorld}</p>
            </SectionCard>

            <SectionCard title="Internal Working">
              <p className="text-[15px] leading-8 text-slate-700">{content.internals}</p>
            </SectionCard>

            <SectionCard title="Performance Considerations">
              {content.performance.map((item) => (
                <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
                  {item}
                </div>
              ))}
            </SectionCard>

            <SectionCard title="Common Mistakes">
              {content.mistakes.map((item) => (
                <div key={item} className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
                  {item}
                </div>
              ))}
            </SectionCard>

            <SectionCard title="Common Confusions">
              <PremiumCallout title="Do Not Mix These Up" items={content.commonConfusions} tone="amber" />
            </SectionCard>

            <SectionCard title="Interview Questions">
              {content.interview.map((item) => (
                <div key={item} className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
                  {item}
                </div>
              ))}
            </SectionCard>

            <SectionCard title="Practice Questions">
              {content.practice.map((item) => (
                <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
                  {item}
                </div>
              ))}
            </SectionCard>

            <SectionCard title="Mini Practice">
              <PremiumCallout title="Try It Yourself" items={content.miniPractice} tone="blue" />
            </SectionCard>

            <SectionCard title="Summary Notes">
              {content.summary.map((item) => (
                <div key={item} className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800">
                  {item}
                </div>
              ))}
            </SectionCard>

            <TopicReference topic={currentTopic} moduleReferenceLines={currentModule.referenceLines} />
            <ModuleReference moduleItem={currentModule} />
          </>
        )}
      </div>
    </div>
  );
};

export default SqlStudyPage;
