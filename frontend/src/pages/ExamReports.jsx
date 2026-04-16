import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { apiGet } from "../utils/api";
import { zipSync, strToU8 } from "fflate";

const ExamReports = () => {
  const { examId } = useParams();
  const [results, setResults] = useState(null);
  const [logs, setLogs] = useState([]);
  const [snapshots, setSnapshots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const [resultPayload, logPayload, snapshotPayload] = await Promise.all([
          apiGet(`/portal/exams/${examId}/results`),
          apiGet(`/portal/exams/${examId}/logs`),
          apiGet(`/portal/exams/${examId}/snapshots`),
        ]);
        if (!active) return;
        setResults(resultPayload);
        setLogs(logPayload.items || []);
        setSnapshots(snapshotPayload.items || []);
      } catch (requestError) {
        if (active) setError(requestError.message || "Unable to load exam report");
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [examId]);

  if (loading) {
    return <div className="rounded-[24px] border border-dashed border-slate-200 px-5 py-10 text-sm text-slate-500">Loading exam report...</div>;
  }

  if (error || !results) {
    return <div className="rounded-[24px] border border-red-200 bg-red-50 px-5 py-10 text-sm text-red-600">{error || "Report unavailable"}</div>;
  }

  const proctorSummary = {
    fullscreenExits: logs.filter((item) => item.event_type === "fullscreen_exit").length,
    tabHidden: logs.filter((item) => item.event_type === "tab_hidden").length,
    blurEvents: logs.filter((item) => item.event_type === "window_blur").length,
    blockedActions: logs.filter((item) => item.event_type === "blocked_action" || item.event_type === "blocked_shortcut").length,
    forcedLogouts: logs.filter((item) => item.event_type === "forced_logout").length,
  };

  const filteredAttempts = (results.items || []).filter((attempt) => {
    const needle = search.trim().toLowerCase();
    if (!needle) return true;
    return [attempt.student?.name, attempt.student?.identifier, attempt.student?.department]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(needle));
  });

  const downloadEvidenceZip = () => {
    const files = {
      "exam-summary.json": strToU8(JSON.stringify({
        exam: results.exam,
        proctorSummary,
        snapshotCount: snapshots.length,
      }, null, 2)),
      "logs.json": strToU8(JSON.stringify(logs, null, 2)),
    };

    snapshots.forEach((shot, index) => {
      const ext = shot.mime_type?.includes("png") ? "png" : "jpg";
      const base64 = String(shot.image_data || "").split(",")[1] || "";
      files[`snapshots/${String(index + 1).padStart(3, "0")}-${shot.student_id}-${shot.trigger_type}.${ext}`] = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
      files[`snapshots/${String(index + 1).padStart(3, "0")}-${shot.student_id}-${shot.trigger_type}.json`] = strToU8(JSON.stringify(shot, null, 2));
    });

    const blob = new Blob([zipSync(files)], { type: "application/zip" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `exam-${results.exam.id}-evidence.zip`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="space-y-6">
      <section className="erp-card rounded-[32px] px-6 py-8">
        <p className="text-xs font-semibold uppercase tracking-[0.45em] text-blue-600">Exam Reports</p>
        <h1 className="mt-3 text-4xl font-extrabold text-slate-900">{results.exam.title}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
          Review student submissions, answer payloads, per-question scoring, and audit logs for this exam.
        </p>
      </section>

      <section className="grid gap-5 md:grid-cols-3">
        <article className="erp-card rounded-[28px] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-600">Attempts</p>
          <p className="mt-4 text-4xl font-extrabold text-slate-900">{results.summary?.attempt_count ?? results.items.length}</p>
        </article>
        <article className="erp-card rounded-[28px] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-600">Questions</p>
          <p className="mt-4 text-4xl font-extrabold text-slate-900">{results.exam.question_links.length}</p>
        </article>
        <article className="erp-card rounded-[28px] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-600">Audit Logs</p>
          <p className="mt-4 text-4xl font-extrabold text-slate-900">{logs.length}</p>
        </article>
      </section>

      <section className="grid gap-5 md:grid-cols-3">
        <article className="erp-card rounded-[24px] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-600">Submitted</p>
          <p className="mt-4 text-3xl font-extrabold text-slate-900">{results.summary?.submitted_count ?? 0}</p>
        </article>
        <article className="erp-card rounded-[24px] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-600">Average Score</p>
          <p className="mt-4 text-3xl font-extrabold text-slate-900">{results.summary?.average_score ?? 0}</p>
        </article>
        <article className="erp-card rounded-[24px] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-600">Highest Score</p>
          <p className="mt-4 text-3xl font-extrabold text-slate-900">{results.summary?.highest_score ?? 0}</p>
        </article>
      </section>

      <section className="grid gap-5 md:grid-cols-5">
        <article className="erp-card rounded-[24px] p-5"><p className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-600">Fullscreen Exits</p><p className="mt-4 text-3xl font-extrabold text-slate-900">{proctorSummary.fullscreenExits}</p></article>
        <article className="erp-card rounded-[24px] p-5"><p className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-600">Hidden Tabs</p><p className="mt-4 text-3xl font-extrabold text-slate-900">{proctorSummary.tabHidden}</p></article>
        <article className="erp-card rounded-[24px] p-5"><p className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-600">Blur Events</p><p className="mt-4 text-3xl font-extrabold text-slate-900">{proctorSummary.blurEvents}</p></article>
        <article className="erp-card rounded-[24px] p-5"><p className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-600">Blocked Actions</p><p className="mt-4 text-3xl font-extrabold text-slate-900">{proctorSummary.blockedActions}</p></article>
        <article className="erp-card rounded-[24px] p-5"><p className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-600">Forced Logouts</p><p className="mt-4 text-3xl font-extrabold text-slate-900">{proctorSummary.forcedLogouts}</p></article>
      </section>

      <section className="erp-card rounded-[30px] p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.4em] text-blue-600">Snapshot Evidence</p>
            <h2 className="mt-3 text-2xl font-extrabold text-slate-900">Random webcam captures</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">Snapshots remain available for 7 days, then are removed automatically by retention cleanup.</p>
          </div>
          <button type="button" onClick={downloadEvidenceZip} className="rounded-full bg-[#0F5BD8] px-5 py-3 text-sm font-semibold text-white">
            Download Evidence ZIP
          </button>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {snapshots.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-slate-200 px-5 py-10 text-sm text-slate-500">No snapshots captured yet.</div>
          ) : snapshots.map((shot) => (
            <article key={shot.id} className="overflow-hidden rounded-[24px] border border-slate-200 bg-slate-50">
              <img src={shot.image_data} alt={`Snapshot ${shot.id}`} className="h-52 w-full object-cover" />
              <div className="space-y-2 p-4 text-sm text-slate-600">
                <p className="font-bold text-slate-900">{shot.student?.name || `Student #${shot.student_id}`}</p>
                {shot.student?.identifier && <p>{shot.student.identifier}</p>}
                <p>Trigger: {shot.trigger_type}</p>
                <p>Face status: {shot.face_status}</p>
                <p>Captured: {new Date(shot.captured_at).toLocaleString()}</p>
                <p>Expires: {new Date(shot.expires_at).toLocaleString()}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-5">
          <div className="erp-card rounded-[24px] p-4">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by student name, identifier, or department"
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
            />
          </div>
          {filteredAttempts.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-slate-200 px-5 py-10 text-sm text-slate-500">No attempts yet.</div>
          ) : (
            filteredAttempts.map((attempt) => (
              <article key={attempt.id} className="erp-card rounded-[30px] p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-2xl font-extrabold text-slate-900">{attempt.student?.name}</p>
                    <p className="mt-2 text-sm text-slate-500">{attempt.student?.identifier} · {attempt.student?.department}</p>
                  </div>
                  <div className="rounded-[24px] border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700">
                    {attempt.score}/{attempt.max_score} · {attempt.status}
                  </div>
                </div>
                <div className="mt-5 space-y-3">
                  {(attempt.answer_breakdown || []).map((answer) => (
                    <div key={`${attempt.id}-${answer.question_link_id}`} className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <p className="text-sm font-bold text-slate-900">{answer.question_title}</p>
                          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{answer.question_type}</p>
                        </div>
                        <p className="text-sm font-semibold text-slate-700">{answer.score}/{answer.max_score}</p>
                      </div>
                      {answer.answer_text && <pre className="mt-3 whitespace-pre-wrap rounded-2xl bg-white px-4 py-3 text-xs text-slate-700">{answer.answer_text}</pre>}
                      {(answer.selected_options || []).length > 0 && <p className="mt-3 text-sm text-slate-600">Selected: {answer.selected_options.join(", ")}</p>}
                      {answer.draft_payload?.language && <p className="mt-2 text-sm text-slate-600">Language: {answer.draft_payload.language}</p>}
                      {(answer.question_type === "coding" || answer.question_type === "sql") && (
                        <div className="mt-3 rounded-2xl bg-white px-4 py-3 text-sm text-slate-600">
                          <p>Visible: {answer.draft_payload?.visible_passed || 0}/{answer.draft_payload?.visible_total || 0}</p>
                          <p className="mt-1">Hidden: {answer.draft_payload?.hidden_passed || 0}/{answer.draft_payload?.hidden_total || 0}</p>
                          {answer.draft_payload?.execution_time_ms != null && <p className="mt-1">Execution: {Math.round(answer.draft_payload.execution_time_ms)} ms</p>}
                        </div>
                      )}
                      {(answer.draft_payload?.test_case_results || []).length > 0 && (
                        <div className="mt-3 space-y-2">
                          {answer.draft_payload.test_case_results.map((item) => (
                            <div key={`${answer.question_link_id}-${item.id}`} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-700">
                              {item.is_hidden ? "Hidden" : "Visible"} {item.id}: {item.passed ? "Passed" : "Failed"}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </article>
            ))
          )}
        </div>

        <section className="erp-card rounded-[30px] p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-blue-600">Audit Timeline</p>
          <div className="mt-5 space-y-3">
            {logs.length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">No logs recorded yet.</div>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-slate-900">{log.event_type}</p>
                      <p className="mt-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{log.actor_role} #{log.actor_user_id}{log.actor_name ? ` · ${log.actor_name}` : ""}</p>
                    </div>
                    <span className="text-xs text-slate-500">{new Date(log.created_at).toLocaleString()}</span>
                  </div>
                  <pre className="mt-3 whitespace-pre-wrap rounded-2xl bg-white px-4 py-3 text-xs text-slate-700">{JSON.stringify(log.details || {}, null, 2)}</pre>
                </div>
              ))
            )}
          </div>
        </section>
      </section>
    </div>
  );
};

export default ExamReports;
