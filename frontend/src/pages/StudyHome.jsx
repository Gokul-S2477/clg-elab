import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { SQL_STUDY_COURSE } from "../data/sqlStudyCourse";
import { getStoredUser } from "../utils/roleHelper";
import { getSqlCompletionPercent, readSqlStudyProgress } from "../utils/sqlStudyProgress";

const StudyHome = () => {
  const navigate = useNavigate();
  const user = getStoredUser();

  const progress = useMemo(() => readSqlStudyProgress(user?.name || user?.role || "guest"), [user]);
  const completion = getSqlCompletionPercent(progress);

  return (
    <div className="space-y-8">
      <section className="erp-card rounded-[32px] bg-white px-6 py-8 md:px-8">
        <p className="text-sm font-semibold uppercase tracking-[0.4em] text-blue-600">Study Modules</p>
        <h1 className="mt-3 text-4xl font-extrabold text-slate-900">Learn SQL topic by topic.</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-500">
          Open the SQL study module as a full document-style tutorial with the original Word-file content preserved,
          organized into a sidebar topic reader for quick navigation.
        </p>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <button
          type="button"
          onClick={() => navigate("/study/sql")}
          className="group relative overflow-hidden rounded-[32px] border border-cyan-100 bg-white text-left shadow-[0_20px_50px_rgba(15,91,216,0.12)] transition-transform duration-200 hover:-translate-y-1"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-300 via-teal-300 to-blue-500 opacity-95" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.35),transparent_32%)]" />
          <div className="relative flex min-h-[360px] flex-col justify-between p-8">
            <div>
              <p className="text-sm font-semibold text-white/85">Detailed Explanation Of</p>
              <h2 className="mt-3 max-w-md text-5xl font-extrabold leading-tight text-white">{SQL_STUDY_COURSE.title}</h2>
              <p className="mt-4 max-w-md text-sm leading-7 text-white/85">{SQL_STUDY_COURSE.subtitle}</p>
            </div>

            <div className="mt-8 flex items-end justify-between gap-4">
              <div className="grid grid-cols-3 gap-6 rounded-[24px] bg-white/92 px-6 py-5 text-slate-900 backdrop-blur">
                <div>
                  <p className="text-3xl font-extrabold">{SQL_STUDY_COURSE.stats.chapters}</p>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Chapters</p>
                </div>
                <div>
                  <p className="text-3xl font-extrabold">{SQL_STUDY_COURSE.stats.items}</p>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Items</p>
                </div>
                <div>
                  <p className="text-3xl font-extrabold">{completion}%</p>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Progress</p>
                </div>
              </div>

              <div className="flex h-20 w-20 items-center justify-center rounded-full border-8 border-white/80 bg-white text-3xl font-bold text-blue-600 shadow-lg transition-transform duration-200 group-hover:scale-105">
                &gt;
              </div>
            </div>
          </div>
        </button>

        <div className="erp-card rounded-[32px] bg-white p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-blue-600">What You Get</p>
          <div className="mt-5 space-y-4">
            {[
              "Structured module sidebar with all SQL topics",
              "Imported detailed explanations from the provided SQL file",
              "Topic-by-topic reading layout inspired by tutorial websites",
              "Continue-reading support using saved sidebar position",
              "Room to extend later with extra examples and practice",
            ].map((item) => (
              <div key={item} className="rounded-2xl border border-blue-100 bg-blue-50/60 px-4 py-3 text-sm font-medium text-slate-700">
                {item}
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Continue Previous</p>
            <p className="mt-2 text-lg font-bold text-slate-900">
              {progress.lastTopicId
                ? SQL_STUDY_COURSE.topics.find((topic) => topic.id === progress.lastTopicId)?.title || "Start SQL Language"
                : "Start SQL Language"}
            </p>
            <button
              type="button"
              onClick={() => navigate(`/study/sql?topic=${progress.lastTopicId || SQL_STUDY_COURSE.topics[0].id}`)}
              className="mt-4 rounded-full bg-[#0F5BD8] px-5 py-2 text-sm font-semibold text-white"
            >
              Open Course
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default StudyHome;
