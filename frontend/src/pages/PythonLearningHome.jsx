import React from "react";
import { useNavigate } from "react-router-dom";

const PythonLearningHome = () => {
  const navigate = useNavigate();

  return (
    <div className="space-y-8">
      <section className="erp-card rounded-[32px] bg-white px-6 py-8 md:px-8">
        <p className="text-sm font-semibold uppercase tracking-[0.4em] text-blue-600">Study Modules</p>
        <h1 className="mt-3 text-4xl font-extrabold text-slate-900">Python Learning Module</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-500">
          This is the standalone Python learning module space. We can add topics, subtopics, examples, visuals, and practice blocks here next without mixing it into the SQL module structure.
        </p>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="group relative overflow-hidden rounded-[32px] border border-blue-100 bg-white text-left shadow-[0_20px_50px_rgba(15,91,216,0.12)]">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-300 via-sky-300 to-cyan-500 opacity-95" />
          <div className="relative flex min-h-[320px] flex-col justify-between p-8 text-white">
            <div>
              <p className="text-sm font-semibold text-white/85">New Learning Space</p>
              <h2 className="mt-3 text-5xl font-extrabold leading-tight">Python</h2>
              <p className="mt-4 max-w-md text-sm leading-7 text-white/90">
                Keep Python as its own module family. Topics and detailed lesson structure can be added later without affecting SQL.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-4 rounded-[24px] bg-white/90 px-5 py-4 text-slate-900 backdrop-blur">
              <div>
                <p className="text-2xl font-extrabold">1</p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Module</p>
              </div>
              <div>
                <p className="text-2xl font-extrabold">0</p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Topics Yet</p>
              </div>
              <div>
                <p className="text-2xl font-extrabold">Ready</p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Status</p>
              </div>
            </div>
          </div>
        </div>

        <div className="erp-card rounded-[32px] bg-white p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-blue-600">Next Build</p>
          <div className="mt-5 space-y-4">
            {[
              "Python basics, syntax, data types, and control flow",
              "Functions, OOP, files, and exception handling",
              "Beginner-to-advanced examples and visual explanations",
              "Practice questions and topic-based navigation",
            ].map((item) => (
              <div key={item} className="rounded-2xl border border-blue-100 bg-blue-50/60 px-4 py-3 text-sm font-medium text-slate-700">
                {item}
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => navigate("/study")}
            className="mt-6 rounded-full bg-[#0F5BD8] px-5 py-2 text-sm font-semibold text-white"
          >
            Back to Study Modules
          </button>
        </div>
      </section>
    </div>
  );
};

export default PythonLearningHome;
