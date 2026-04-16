import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet } from "../utils/api";
import { getStoredUser, isPrivilegedRole } from "../utils/roleHelper";

const formatDateTime = (value) =>
  value ? new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "Not scheduled";

const deriveStudentExamState = (exam) => {
  const now = Date.now();
  const start = new Date(exam.start_time).getTime();
  const end = new Date(exam.end_time).getTime();
  if (now < start) return { key: "waiting", label: "Upcoming" };
  if (now > end) return { key: "review", label: "Review" };
  return { key: "live", label: "Live" };
};

const ExamsList = () => {
  const navigate = useNavigate();
  const user = getStoredUser();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const payload = await apiGet("/portal/exams");
        if (active) setItems(payload.items || []);
      } catch (requestError) {
        if (active) setError(requestError.message || "Unable to load exams");
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [user?.id]);

  const privileged = isPrivilegedRole(user?.role);

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[34px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.18),_transparent_38%),radial-gradient(circle_at_bottom_right,_rgba(20,184,166,0.16),_transparent_32%),linear-gradient(135deg,_#ffffff,_#f8fbff)] px-6 py-8 shadow-[0_22px_70px_rgba(15,91,216,0.08)]">
        <p className="text-xs font-semibold uppercase tracking-[0.45em] text-blue-600">Exam Directory</p>
        <h1 className="mt-3 text-4xl font-extrabold text-slate-900">{privileged ? "All accessible exams" : "Your assigned exams"}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
          {privileged
            ? "Review configuration, assigned students, and reports for the exams you can access."
            : "Wait for the exam start time, enter the protected fullscreen flow, and return later in review mode when the exam policy allows it."}
        </p>
      </section>

      {error && <div className="rounded-3xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-600">{error}</div>}

      <section className="grid gap-5">
        {loading ? (
          <div className="rounded-[24px] border border-dashed border-slate-200 px-5 py-10 text-sm text-slate-500">Loading exams...</div>
        ) : items.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-slate-200 px-5 py-10 text-sm text-slate-500">No exams found for this role.</div>
        ) : (
          items.map((exam) => {
            const studentState = privileged ? null : deriveStudentExamState(exam);
            const actionLabel = privileged
              ? "Open Report View"
              : studentState.key === "waiting"
                ? "Open Wait Room"
                : studentState.key === "live"
                  ? "Enter Exam"
                  : "Review Paper";
            return (
            <article key={exam.id} className="erp-card rounded-[30px] p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-2xl font-extrabold text-slate-900">{exam.title}</p>
                  <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">{exam.description || exam.instructions}</p>
                  {!privileged && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.22em] ${
                        studentState.key === "live"
                          ? "bg-emerald-100 text-emerald-700"
                          : studentState.key === "review"
                            ? "bg-slate-200 text-slate-700"
                            : "bg-amber-100 text-amber-700"
                      }`}>
                        {studentState.label}
                      </span>
                      <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.22em] ${exam.review_policy?.allow_post_exam_review ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"}`}>
                        {exam.review_policy?.allow_post_exam_review ? "Review Enabled" : "Review Locked"}
                      </span>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => navigate(privileged ? `/exam-reports/${exam.id}` : `/exams/${exam.id}`)}
                  className="rounded-full bg-[#0F5BD8] px-5 py-3 text-sm font-semibold text-white"
                >
                  {actionLabel}
                </button>
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-4">
                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Status</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{exam.status}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Starts</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{formatDateTime(exam.start_time)}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Duration</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{exam.duration_minutes} mins</p>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Assignments</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{exam.assigned_students.length} students</p>
                </div>
              </div>
            </article>
          );
          })
        )}
      </section>
    </div>
  );
};

export default ExamsList;
