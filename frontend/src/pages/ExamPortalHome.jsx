import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getStoredUser, isPrivilegedRole } from "../utils/roleHelper";
import { getPortalBootstrap } from "../utils/portalBootstrap";

const statusTone = {
  draft: "bg-slate-100 text-slate-700",
  scheduled: "bg-amber-100 text-amber-700",
  published: "bg-emerald-100 text-emerald-700",
  archived: "bg-slate-200 text-slate-700",
};

const formatDateTime = (value) =>
  value ? new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "Not set";

const ExamPortalHome = () => {
  const navigate = useNavigate();
  const user = getStoredUser();
  const [data, setData] = useState({ exams: [], question_bank: [], students: [], faculty: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const payload = await getPortalBootstrap();
        if (active) setData(payload);
      } catch (requestError) {
        if (active) setError(requestError.message || "Unable to load exam portal");
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [user?.id]);

  const stats = useMemo(() => {
    const exams = data.exams || [];
    return {
      totalExams: exams.length,
      liveExams: exams.filter((item) => item.status === "published").length,
      draftExams: exams.filter((item) => item.status === "draft").length,
      questionBank: (data.question_bank || []).length,
    };
  }, [data]);

  const isPrivileged = isPrivilegedRole(user?.role);

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[34px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.18),_transparent_38%),radial-gradient(circle_at_bottom_right,_rgba(20,184,166,0.16),_transparent_32%),linear-gradient(135deg,_#ffffff,_#f7fbff)] px-6 py-8 shadow-[0_22px_70px_rgba(15,91,216,0.08)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.45em] text-blue-600">Premium Exam Portal</p>
            <h1 className="mt-3 text-4xl font-extrabold text-slate-900">Central exam command center</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
              Create premium mixed-format exams, enforce protected fullscreen access, run coding and SQL papers, and review complete evidence, scores, and audit logs from one portal.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {isPrivileged && (
              <button type="button" onClick={() => navigate("/exam-management")} className="rounded-full bg-[#0F5BD8] px-5 py-3 text-sm font-semibold text-white">
                Open Exam Management
              </button>
            )}
            <button type="button" onClick={() => navigate("/exams")} className="rounded-full border border-blue-100 bg-blue-50 px-5 py-3 text-sm font-semibold text-blue-700">
              View My Exams
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Visible Exams", value: stats.totalExams, hint: "Exams shown for your role" },
          { label: "Published Exams", value: stats.liveExams, hint: "Ready for students" },
          { label: "Draft Exams", value: stats.draftExams, hint: "Still being prepared" },
          { label: "Question Bank", value: stats.questionBank, hint: "Reusable exam questions" },
        ].map((card) => (
          <article key={card.label} className="erp-card rounded-[28px] p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-600">{card.label}</p>
            <p className="mt-4 text-4xl font-extrabold text-slate-900">{card.value}</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">{card.hint}</p>
          </article>
        ))}
      </section>

      {error && <div className="rounded-3xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-600">{error}</div>}

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="erp-card rounded-[30px] p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.4em] text-blue-600">{isPrivileged ? "Exam List" : "Assigned Exams"}</p>
              <h2 className="mt-3 text-2xl font-extrabold text-slate-900">Upcoming and active exams</h2>
            </div>
          </div>
          <div className="mt-5 space-y-4">
            {loading ? (
              <div className="rounded-[24px] border border-dashed border-slate-200 px-5 py-8 text-sm text-slate-500">Loading exams...</div>
            ) : (data.exams || []).length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-slate-200 px-5 py-8 text-sm text-slate-500">No exams available yet.</div>
            ) : (
              data.exams.map((exam) => (
                <button key={exam.id} type="button" onClick={() => navigate(isPrivileged ? `/exam-reports/${exam.id}` : `/exams/${exam.id}`)} className="w-full rounded-[24px] border border-slate-200 bg-slate-50 p-5 text-left transition hover:border-blue-100 hover:bg-blue-50/70">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-lg font-bold text-slate-900">{exam.title}</p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{exam.description}</p>
                    </div>
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] ${statusTone[exam.status] || statusTone.draft}`}>{exam.status}</span>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <div className="rounded-2xl bg-white px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Starts</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">{formatDateTime(exam.start_time)}</p>
                    </div>
                    <div className="rounded-2xl bg-white px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Duration</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">{exam.duration_minutes} mins</p>
                    </div>
                    <div className="rounded-2xl bg-white px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Questions</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">{exam.question_links.length}</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="space-y-6">
          <section className="erp-card rounded-[30px] p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.4em] text-blue-600">Role Snapshot</p>
            <h2 className="mt-3 text-2xl font-extrabold text-slate-900">{isPrivileged ? "Admin and faculty controls" : "Student exam access"}</h2>
            <div className="mt-5 space-y-3 text-sm leading-7 text-slate-600">
              {isPrivileged ? (
                <>
                  <p>Create draft exams with password protection, faculty access, department targeting, and selected-student assignments.</p>
                  <p>Publish an exam, review attempts, audit logs, answer payloads, and per-question score breakdowns from the report view.</p>
                </>
              ) : (
                <>
                  <p>Students can enter the wait room, verify the exam password again, start only when ready, save progress, and submit before the timer ends.</p>
                  <p>Manual and auto-submit statuses are tracked and visible to faculty, admin, and super admin from the reporting dashboard.</p>
                </>
              )}
            </div>
          </section>

          <section className="erp-card rounded-[30px] p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.4em] text-blue-600">Portal Coverage</p>
            <div className="mt-4 grid gap-3">
              {[
                "Role-based login and student identity mapping",
                "Question bank for MCQ, written, coding, and SQL prompts",
                "Exam scheduling, password entry, wait-room, and timer support",
                "Assignment by department and selected students",
                "Faculty access, result review, and audit logs",
              ].map((item) => (
                <div key={item} className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
                  {item}
                </div>
              ))}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
};

export default ExamPortalHome;
