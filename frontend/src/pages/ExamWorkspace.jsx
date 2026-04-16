import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiGet, apiPost, apiPut } from "../utils/api";
import { getStoredUser, logout } from "../utils/roleHelper";
import { getProctorSettings, isFullscreenActive } from "../utils/proctorSettings";

const makeAnswerState = (exam, attempt) => {
  const existing = new Map((attempt?.answers || []).map((item) => [item.question_link_id, item]));
  const state = {};
  (exam?.question_links || []).forEach((link) => {
    const answer = existing.get(link.id);
    state[link.id] = {
      question_link_id: link.id,
      answer_text: answer?.answer_text || "",
      selected_options: answer?.selected_options || [],
      draft_payload: answer?.draft_payload || {},
      max_score: link.points,
    };
  });
  return state;
};

const languageLabels = {
  python: "Python",
  javascript: "JavaScript",
  java: "Java",
  cpp: "C++",
  c: "C",
  sql: "SQL",
};

const formatDateTime = (value) => (value ? new Date(value).toLocaleString() : "Not available");

const ExamWorkspace = () => {
  const { examId } = useParams();
  const navigate = useNavigate();
  const user = getStoredUser();
  const proctorSettings = getProctorSettings();
  const violationBufferRef = useRef(new Set());
  const violationStateRef = useRef({
    blurCount: 0,
    visibilityCount: 0,
    fullscreenExitCount: 0,
    blockedActionCount: 0,
    forcedLogoutCount: 0,
  });
  const webcamVideoRef = useRef(null);
  const webcamStreamRef = useRef(null);
  const snapshotTimerRef = useRef(null);
  const [exam, setExam] = useState(null);
  const [attempt, setAttempt] = useState(null);
  const [answers, setAnswers] = useState({});
  const [examPassword, setExamPassword] = useState("");
  const [timeLeft, setTimeLeft] = useState(0);
  const [judgeBusy, setJudgeBusy] = useState({});
  const [permissionState, setPermissionState] = useState({ camera: false, microphone: false, fullscreen: false });
  const [permissionsChecked, setPermissionsChecked] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [violationState, setViolationState] = useState({
    blurCount: 0,
    visibilityCount: 0,
    fullscreenExitCount: 0,
    blockedActionCount: 0,
    forcedLogoutCount: 0,
  });
  const [fullscreenTimer, setFullscreenTimer] = useState(0);
  const [screenLocked, setScreenLocked] = useState(false);
  const [judgeLock, setJudgeLock] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    violationStateRef.current = violationState;
  }, [violationState]);

  const loadExam = async () => {
    setLoading(true);
    setError("");
    try {
      const payload = await apiGet(`/portal/exams/${examId}`);
      const studentAttempt = (payload.attempts || []).find((item) => item.student?.id === user.id) || null;
      setExam(payload);
      setAttempt(studentAttempt);
      setAnswers(makeAnswerState(payload, studentAttempt));
    } catch (requestError) {
      setError(requestError.message || "Unable to load exam");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExam();
  }, [examId]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (!exam) return;
      const end = new Date(exam.end_time).getTime();
      setTimeLeft(Math.max(0, Math.floor((end - Date.now()) / 1000)));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [exam]);

  useEffect(() => {
    const examIsOpen = exam ? Date.now() >= new Date(exam.start_time).getTime() && Date.now() <= new Date(exam.end_time).getTime() : false;
    if (!attempt || attempt.status !== "in_progress" || judgeLock || !examIsOpen) return undefined;
    const interval = window.setInterval(() => {
      apiPut(
        `/portal/attempts/${attempt.id}/answers`,
        { student_id: user.id, answers: Object.values(answers) },
        { wrapData: false },
      ).catch(() => undefined);
    }, 15000);
    return () => window.clearInterval(interval);
  }, [attempt, answers, exam, judgeLock, user.id]);

  useEffect(() => {
    if (timeLeft !== 0 || !attempt || !exam?.auto_submit_enabled || !["in_progress", "not_started"].includes(attempt.status)) return;
    apiPost(`/portal/attempts/${attempt.id}/submit`, { student_id: user.id, auto_submitted: true })
      .then((payload) => {
        setAttempt(payload.attempt);
        setStatusMessage("Time ended. Your exam was auto-submitted.");
        setScreenLocked(false);
      })
      .catch(() => undefined);
  }, [timeLeft, attempt, exam, user.id]);

  useEffect(() => {
    if (!screenLocked || fullscreenTimer <= 0) return undefined;
    const timer = window.setInterval(() => {
      setFullscreenTimer((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          handleForcedLogout("fullscreen_timeout");
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [screenLocked, fullscreenTimer]);

  const derivedStatus = useMemo(() => {
    if (!exam) return "loading";
    const now = Date.now();
    const start = new Date(exam.start_time).getTime();
    const end = new Date(exam.end_time).getTime();
    if (now < start) return "waiting";
    if (now > end) return "ended";
    return "open";
  }, [exam]);

  const submitted = attempt && ["submitted", "auto_submitted"].includes(attempt.status);
  const reviewPolicy = exam?.review_policy || {};
  const reviewMode = derivedStatus === "ended" || submitted;
  const reviewContentVisible = Boolean(submitted || exam?.review_enabled);
  const scoreVisibleInReview = Boolean(reviewPolicy.show_score_in_review || exam?.show_score_immediately);
  const answerKeyVisibleInReview = Boolean(reviewPolicy.show_answer_key_in_review);
  const guardEnabled = Boolean(attempt && attempt.status === "in_progress" && derivedStatus === "open" && !submitted);

  const recordEvent = async (eventType, details = {}) => {
    if (!attempt?.id) return;
    const key = `${eventType}:${JSON.stringify(details)}`;
    if (violationBufferRef.current.has(key)) return;
    violationBufferRef.current.add(key);
    window.setTimeout(() => violationBufferRef.current.delete(key), 1200);
    try {
      await apiPost(`/portal/attempts/${attempt.id}/events`, {
        actor_user_id: user.id,
        actor_role: user.role,
        event_type: eventType,
        details,
      });
    } catch {
      // keep UI resilient even if logging fails
    }
  };

  const saveNow = async (silent = false) => {
    if (!attempt) return null;
    const payload = await apiPut(
      `/portal/attempts/${attempt.id}/answers`,
      { student_id: user.id, answers: Object.values(answers) },
      { wrapData: false },
    );
    setAttempt(payload.attempt);
    if (!silent) setStatusMessage("Progress saved.");
    return payload;
  };

  const handleForcedLogout = async (reason) => {
    setJudgeLock(true);
    setScreenLocked(true);
    setViolationState((current) => ({ ...current, forcedLogoutCount: current.forcedLogoutCount + 1 }));
    await recordEvent("forced_logout", {
      reason,
      blurCount: violationStateRef.current.blurCount,
      visibilityCount: violationStateRef.current.visibilityCount,
      fullscreenExitCount: violationStateRef.current.fullscreenExitCount,
      blockedActionCount: violationStateRef.current.blockedActionCount,
    });
    try {
      await saveNow(true);
    } catch {
      // ignore save failure on forced logout
    }
    logout();
  };

  const requestExamPermissions = async () => {
    setError("");
    try {
      const constraints = {
        video: Boolean(proctorSettings.examCameraRequired),
        audio: Boolean(proctorSettings.examMicrophoneRequired),
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (webcamStreamRef.current) {
        webcamStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      webcamStreamRef.current = stream;
      setCameraActive(true);
      const nextState = {
        camera: !proctorSettings.examCameraRequired || constraints.video,
        microphone: !proctorSettings.examMicrophoneRequired || constraints.audio,
        fullscreen: isFullscreenActive(),
      };
      setPermissionState(nextState);
      setPermissionsChecked(true);
      await recordEvent("exam_permissions_granted", nextState);
      setStatusMessage("Required permissions granted. Enter fullscreen and start the attempt.");
    } catch (requestError) {
      setPermissionsChecked(true);
      setPermissionState((current) => ({ ...current, camera: false, microphone: false }));
      setError("Camera or microphone permission was denied. Grant the required permissions to continue.");
      await recordEvent("exam_permissions_denied", { message: requestError.message || "permission denied" });
    }
  };

  const requestFullscreen = async () => {
    try {
      if (!isFullscreenActive()) {
        await document.documentElement.requestFullscreen();
      }
      setPermissionState((current) => ({ ...current, fullscreen: true }));
      if (screenLocked) {
        setScreenLocked(false);
        setFullscreenTimer(0);
        setStatusMessage("Fullscreen restored. Exam resumed.");
        await recordEvent("fullscreen_restored", {});
      }
    } catch {
      setError("Fullscreen permission was denied. Please try again.");
    }
  };

  const launchProtectedMode = async () => {
    await requestExamPermissions();
    if (proctorSettings.requireFullscreen) {
      await requestFullscreen();
    }
    setStatusMessage("Protected mode checklist started. Confirm the indicators below and begin the exam.");
  };

  const lockExamForFullscreenExit = async () => {
    if (screenLocked || !guardEnabled || !proctorSettings.requireFullscreen) return;
    setScreenLocked(true);
    setFullscreenTimer(proctorSettings.fullscreenRecoverySeconds || 10);
    const nextCount = violationStateRef.current.fullscreenExitCount + 1;
    setViolationState((current) => ({ ...current, fullscreenExitCount: current.fullscreenExitCount + 1 }));
    setStatusMessage("Fullscreen was exited. Return within 10 seconds or the exam session will log out.");
    await recordEvent("fullscreen_exit", {
      fullscreenExitCount: nextCount,
      recoverySeconds: proctorSettings.fullscreenRecoverySeconds || 10,
    });
  };

  const detectFaceStatus = async () => {
    try {
      if (typeof window !== "undefined" && "FaceDetector" in window && webcamVideoRef.current) {
        const detector = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 2 });
        const faces = await detector.detect(webcamVideoRef.current);
        if (!faces.length) return "no_face";
        if (faces.length > 1) return "multiple_faces";
        return "face_detected";
      }
    } catch {
      return "unknown";
    }
    return "unknown";
  };

  const captureSnapshot = async (triggerType = "interval", extraDetails = {}) => {
    if (!attempt?.id || !webcamVideoRef.current || !cameraActive) return;
    const video = webcamVideoRef.current;
    if (!video.videoWidth || !video.videoHeight) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = canvas.toDataURL("image/jpeg", 0.78);
    const faceStatus = await detectFaceStatus();
    await apiPost(`/portal/attempts/${attempt.id}/snapshots`, {
      student_id: user.id,
      image_data: imageData,
      mime_type: "image/jpeg",
      trigger_type: triggerType,
      face_status: faceStatus,
      details: extraDetails,
    });
    if (faceStatus === "no_face" || faceStatus === "multiple_faces") {
      await recordEvent("away_detected", { triggerType, faceStatus });
      setStatusMessage(faceStatus === "multiple_faces" ? "Multiple faces detected in webcam snapshot." : "No face detected in webcam snapshot.");
    }
  };

  useEffect(() => {
    if (!guardEnabled) return undefined;

    const handleVisibility = () => {
      if (!document.hidden) return;
      const nextCount = violationStateRef.current.visibilityCount + 1;
      setViolationState((current) => ({ ...current, visibilityCount: current.visibilityCount + 1 }));
      setScreenLocked(true);
      recordEvent("tab_hidden", { visibilityCount: nextCount });
      captureSnapshot("tab_hidden", { visibilityCount: nextCount }).catch(() => undefined);
    };

    const handleBlur = () => {
      const nextCount = violationStateRef.current.blurCount + 1;
      setViolationState((current) => ({ ...current, blurCount: current.blurCount + 1 }));
      setScreenLocked(true);
      recordEvent("window_blur", { blurCount: nextCount });
      captureSnapshot("window_blur", { blurCount: nextCount }).catch(() => undefined);
    };

    const handleFullscreenChange = () => {
      const active = isFullscreenActive();
      setPermissionState((current) => ({ ...current, fullscreen: active }));
      if (proctorSettings.requireFullscreen && !active) {
        lockExamForFullscreenExit();
      } else if (active && screenLocked) {
        setScreenLocked(false);
        setFullscreenTimer(0);
      }
    };

    const handleKeydown = (event) => {
      const key = String(event.key || "").toLowerCase();
      const usesModifier = event.ctrlKey || event.metaKey;
      const shouldBlock =
        key === "contextmenu" ||
        (usesModifier && ["c", "x", "v", "a", "insert"].includes(key)) ||
        (event.shiftKey && ["insert", "delete"].includes(key));
      if (!shouldBlock) return;
      const nextCount = violationStateRef.current.blockedActionCount + 1;
      event.preventDefault();
      event.stopPropagation();
      setViolationState((current) => ({ ...current, blockedActionCount: current.blockedActionCount + 1 }));
      setStatusMessage("Protected mode: copy, paste, cut, and select-all are disabled during the exam.");
      recordEvent("blocked_shortcut", { key, blockedActionCount: nextCount });
      captureSnapshot("blocked_shortcut", { key }).catch(() => undefined);
    };

    const handleBlockedAction = (action) => (event) => {
      const nextCount = violationStateRef.current.blockedActionCount + 1;
      event.preventDefault();
      event.stopPropagation();
      setViolationState((current) => ({ ...current, blockedActionCount: current.blockedActionCount + 1 }));
      setStatusMessage(`Protected mode: ${action} is disabled during the exam.`);
      recordEvent("blocked_action", { action, blockedActionCount: nextCount });
      captureSnapshot("blocked_action", { action }).catch(() => undefined);
    };

    const copyHandler = handleBlockedAction("copy");
    const cutHandler = handleBlockedAction("cut");
    const pasteHandler = handleBlockedAction("paste");
    const contextHandler = handleBlockedAction("context menu");

    window.addEventListener("blur", handleBlur);
    document.addEventListener("visibilitychange", handleVisibility);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    window.addEventListener("keydown", handleKeydown, true);
    document.addEventListener("copy", copyHandler, true);
    document.addEventListener("cut", cutHandler, true);
    document.addEventListener("paste", pasteHandler, true);
    document.addEventListener("contextmenu", contextHandler, true);

    if (proctorSettings.requireFullscreen && !isFullscreenActive()) {
      lockExamForFullscreenExit();
    }

    return () => {
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("visibilitychange", handleVisibility);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      window.removeEventListener("keydown", handleKeydown, true);
      document.removeEventListener("copy", copyHandler, true);
      document.removeEventListener("cut", cutHandler, true);
      document.removeEventListener("paste", pasteHandler, true);
      document.removeEventListener("contextmenu", contextHandler, true);
    };
  }, [guardEnabled, proctorSettings.requireFullscreen, screenLocked]);

  useEffect(() => {
    if (webcamVideoRef.current && webcamStreamRef.current) {
      webcamVideoRef.current.srcObject = webcamStreamRef.current;
      webcamVideoRef.current.play().catch(() => undefined);
    }
  }, [cameraActive]);

  useEffect(() => {
    if (!guardEnabled || !cameraActive || !attempt?.id) return undefined;

    const scheduleNext = () => {
      const nextMs = 25000 + Math.floor(Math.random() * 30000);
      snapshotTimerRef.current = window.setTimeout(async () => {
        await captureSnapshot("interval", { randomDelayMs: nextMs });
        scheduleNext();
      }, nextMs);
    };

    scheduleNext();
    return () => {
      if (snapshotTimerRef.current) {
        window.clearTimeout(snapshotTimerRef.current);
        snapshotTimerRef.current = null;
      }
    };
  }, [guardEnabled, cameraActive, attempt?.id]);

  useEffect(() => () => {
    if (webcamStreamRef.current) {
      webcamStreamRef.current.getTracks().forEach((track) => track.stop());
    }
  }, []);

  const enterWaitRoom = async () => {
    setError("");
    const payload = await apiPost(`/portal/exams/${examId}/wait-room`, { student_id: user.id });
    setAttempt(payload.attempt);
    setExam(payload.exam);
    setStatusMessage("Wait room opened. Verify the exam password to continue.");
  };

  const verifyPassword = async () => {
    setError("");
    try {
      const payload = await apiPost(`/portal/exams/${examId}/verify-password`, {
        student_id: user.id,
        exam_password: examPassword,
      });
      setAttempt((current) => ({ ...(current || {}), id: payload.attempt_id, password_verified_at: new Date().toISOString() }));
      setStatusMessage("Password verified. Complete permission checks and fullscreen before starting.");
    } catch (requestError) {
      setError(requestError.message || "Password verification failed");
    }
  };

  const startAttempt = async () => {
    setError("");
    if (derivedStatus !== "open") {
      setError("This exam can only be started during the scheduled exam window.");
      return;
    }
    if (proctorSettings.examCameraRequired && !permissionState.camera) {
      setError("Camera permission is required before you can start this exam.");
      return;
    }
    if (proctorSettings.examMicrophoneRequired && !permissionState.microphone) {
      setError("Microphone permission is required before you can start this exam.");
      return;
    }
    if (proctorSettings.requireFullscreen && !isFullscreenActive()) {
      await requestFullscreen();
      if (!isFullscreenActive()) {
        setError("Enter fullscreen mode before starting the exam.");
        return;
      }
    }
    try {
      const payload = await apiPost(`/portal/exams/${examId}/attempts/start`, { student_id: user.id });
      setAttempt(payload.attempt);
      setExam(payload.exam);
      setAnswers(makeAnswerState(payload.exam, payload.attempt));
      setScreenLocked(false);
      setFullscreenTimer(0);
      await recordEvent("proctored_session_started", {
        fullscreen: isFullscreenActive(),
        camera: permissionState.camera,
        microphone: permissionState.microphone,
      });
      await captureSnapshot("attempt_started", { fullscreen: isFullscreenActive() });
      setStatusMessage("Attempt started. Proctor guard is active and answers will auto-save.");
    } catch (requestError) {
      setError(requestError.message || "Unable to start attempt");
    }
  };

  const submitExam = async () => {
    if (!attempt) return;
    setError("");
    try {
      await saveNow(true);
      const payload = await apiPost(`/portal/attempts/${attempt.id}/submit`, {
        student_id: user.id,
        auto_submitted: false,
      });
      setAttempt(payload.attempt);
      await recordEvent("manual_submit_completed", {});
      setStatusMessage("Exam submitted successfully.");
      setScreenLocked(false);
    } catch (requestError) {
      setError(requestError.message || "Unable to submit exam");
    }
  };

  const questionTimerInfo = (link) => {
    const durationMinutes = Number(link.question.question_timer_minutes || 0);
    if (!durationMinutes) return null;
    const draftPayload = answers[link.id]?.draft_payload || {};
    const startedAt = draftPayload.question_timer_started_at ? new Date(draftPayload.question_timer_started_at).getTime() : null;
    if (!startedAt) {
      return { durationMinutes, remainingSeconds: durationMinutes * 60, started: false, expired: false };
    }
    const expiresAt = startedAt + durationMinutes * 60 * 1000;
    const remainingSeconds = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
    return { durationMinutes, remainingSeconds, started: true, expired: remainingSeconds <= 0 };
  };

  const ensureQuestionTimerStarted = (questionLinkId) => {
    const link = exam?.question_links?.find((item) => item.id === questionLinkId);
    const durationMinutes = Number(link?.question?.question_timer_minutes || 0);
    if (!durationMinutes) return;
    setAnswers((current) => {
      const existing = current[questionLinkId] || { draft_payload: {} };
      if (existing.draft_payload?.question_timer_started_at) return current;
      return {
        ...current,
        [questionLinkId]: {
          ...existing,
          draft_payload: {
            ...(existing.draft_payload || {}),
            question_timer_started_at: new Date().toISOString(),
          },
        },
      };
    });
  };

  const updateAnswer = (questionLinkId, patch) => {
    ensureQuestionTimerStarted(questionLinkId);
    setAnswers((current) => {
      const existing = current[questionLinkId] || { draft_payload: {} };
      const mergedDraftPayload = patch.draft_payload ? { ...(existing.draft_payload || {}), ...patch.draft_payload } : existing.draft_payload;
      return {
        ...current,
        [questionLinkId]: { ...existing, ...patch, draft_payload: mergedDraftPayload },
      };
    });
  };

  const starterCodeFor = (link, language) => {
    const starter = link.question.answer_schema?.starter_code || {};
    return starter[language] || starter.python || starter.sql || "";
  };

  const judgeQuestion = async (link, mode) => {
    if (!attempt || screenLocked || reviewMode || derivedStatus !== "open") return;
    ensureQuestionTimerStarted(link.id);
    const timer = questionTimerInfo(link);
    if (timer?.expired) {
      setError("This question timer has expired. You can no longer edit or run this question.");
      return;
    }
    const answer = answers[link.id] || {};
    const language = answer.draft_payload?.language || (link.question.question_type === "sql" ? "sql" : "python");
    setJudgeBusy((current) => ({ ...current, [link.id]: mode }));
    setError("");
    try {
      const payload = await apiPost(
        `/portal/attempts/${attempt.id}/questions/${link.id}/${mode === "run" ? "run" : "submit-solution"}`,
        {
          student_id: user.id,
          language,
          code: answer.answer_text || "",
          custom_input: answer.draft_payload?.custom_input || "",
        },
      );
      updateAnswer(link.id, {
        draft_payload: {
          ...(answer.draft_payload || {}),
          language,
          [mode === "run" ? "last_run" : "last_submission"]: payload,
        },
        score: payload.score,
        max_score: payload.max_score,
      });
      await recordEvent(mode === "run" ? "question_run" : "question_submit_evaluated", {
        question_link_id: link.id,
        language,
        score: payload.score,
      });
      setStatusMessage(`${link.question.title}: ${mode === "run" ? "run completed" : "submission evaluated"}.`);
    } catch (requestError) {
      setError(requestError.message || `Unable to ${mode} this solution`);
    } finally {
      setJudgeBusy((current) => ({ ...current, [link.id]: "" }));
    }
  };

  const renderQuestionInput = (link) => {
    const value = answers[link.id] || { answer_text: "", selected_options: [], draft_payload: {} };
    const type = link.question.question_type;
    const timer = questionTimerInfo(link);
    const timerExpired = Boolean(timer?.expired);
    const inputLocked = screenLocked || timerExpired || reviewMode;
    if (type === "mcq") {
      return (
        <div className="space-y-3">
          {timer ? <div className={`rounded-2xl px-4 py-3 text-sm font-semibold ${timerExpired ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"}`}>{timerExpired ? "Question timer ended" : `Question timer: ${String(Math.floor(timer.remainingSeconds / 60)).padStart(2, "0")}:${String(timer.remainingSeconds % 60).padStart(2, "0")}`}</div> : null}
          {(link.question.options || []).map((option) => (
            <label key={option.id} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={value.selected_options.includes(option.id)}
                onChange={(event) => {
                  const next = event.target.checked
                    ? [...value.selected_options, option.id]
                    : value.selected_options.filter((item) => item !== option.id);
                  updateAnswer(link.id, { selected_options: next });
                }}
                disabled={inputLocked}
              />
              {option.label}
            </label>
          ))}
        </div>
      );
    }
    if (type === "coding" || type === "sql") {
      const language = value.draft_payload?.language || (type === "sql" ? "sql" : "python");
      const allowedLanguages = type === "sql" ? ["sql"] : (link.question.answer_schema?.allowed_languages || ["python", "javascript", "cpp", "java", "c"]);
      const judgePayload = value.draft_payload?.last_submission || value.draft_payload?.last_run || null;
      const visibleResults = (judgePayload?.test_case_results || []).filter((item) => !item.is_hidden);
      const hiddenResults = (judgePayload?.test_case_results || []).filter((item) => item.is_hidden);
      return (
        <div className="space-y-3">
          {timer ? <div className={`rounded-2xl px-4 py-3 text-sm font-semibold ${timerExpired ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"}`}>{timerExpired ? "Question timer ended. This answer is locked." : `Question timer: ${String(Math.floor(timer.remainingSeconds / 60)).padStart(2, "0")}:${String(timer.remainingSeconds % 60).padStart(2, "0")}`}</div> : null}
          <div className="grid gap-3 md:grid-cols-[200px_1fr]">
            <select
              value={language}
              onChange={(event) => updateAnswer(link.id, { draft_payload: { ...value.draft_payload, language: event.target.value } })}
              className="rounded-2xl border border-slate-200 px-4 py-3"
              disabled={inputLocked}
            >
              {allowedLanguages.map((item) => <option key={item} value={item}>{languageLabels[item] || item}</option>)}
            </select>
            <input
              value={value.draft_payload?.custom_input || ""}
              onChange={(event) => updateAnswer(link.id, { draft_payload: { ...value.draft_payload, custom_input: event.target.value } })}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3"
              placeholder={type === "sql" ? "Optional custom input is usually not needed for SQL" : "Custom input for run, e.g. [1,2,3]"}
              disabled={inputLocked}
            />
          </div>
          <textarea
            value={value.answer_text}
            onChange={(event) => updateAnswer(link.id, { answer_text: event.target.value })}
            className="min-h-[220px] w-full rounded-2xl border border-slate-200 px-4 py-3 font-mono text-sm"
            placeholder={type === "sql" ? "Write your SQL query here" : "Write your code here"}
            disabled={inputLocked}
          />
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => judgeQuestion(link, "run")} disabled={Boolean(judgeBusy[link.id]) || inputLocked} className="rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 disabled:opacity-60">
              {judgeBusy[link.id] === "run" ? "Running..." : (type === "sql" ? "Run Query" : "Run Code")}
            </button>
            <button type="button" onClick={() => judgeQuestion(link, "submit")} disabled={Boolean(judgeBusy[link.id]) || inputLocked} className="rounded-full bg-[#0F5BD8] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
              {judgeBusy[link.id] === "submit" ? "Submitting..." : (type === "sql" ? "Submit Query" : "Submit Solution")}
            </button>
            <button
              type="button"
              onClick={() => updateAnswer(link.id, { answer_text: starterCodeFor(link, language), draft_payload: { ...value.draft_payload, language } })}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
              disabled={inputLocked}
            >
              Restore Starter Code
            </button>
          </div>
          {judgePayload && (
            <div className="space-y-3 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] ${judgePayload.status === "success" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>{judgePayload.status}</span>
                <span className="text-sm font-semibold text-slate-700">{judgePayload.score}/{judgePayload.max_score} marks</span>
                <span className="text-sm text-slate-500">{Math.round(judgePayload.execution_time_ms || 0)} ms</span>
              </div>
              <pre className="overflow-auto whitespace-pre-wrap rounded-2xl bg-white px-4 py-3 text-xs text-slate-700">{[judgePayload.output, judgePayload.errors].filter(Boolean).join("\n") || "(no output)"}</pre>
              {(visibleResults.length > 0 || hiddenResults.length > 0) && (
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl bg-white p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">Visible Cases</p>
                    <div className="mt-3 space-y-2">
                      {visibleResults.length === 0 ? <p className="text-sm text-slate-500">Run-only mode does not score visible tests yet.</p> : visibleResults.map((item) => (
                        <div key={`${link.id}-v-${item.id}`} className="rounded-2xl border border-slate-200 px-3 py-2 text-sm">
                          Case {item.id}: {item.passed ? "Passed" : "Failed"}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-white p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-600">Hidden Cases</p>
                    <div className="mt-3 space-y-2">
                      {hiddenResults.length === 0 ? <p className="text-sm text-slate-500">Hidden tests appear after solution submission.</p> : hiddenResults.map((item) => (
                        <div key={`${link.id}-h-${item.id}`} className="rounded-2xl border border-slate-200 px-3 py-2 text-sm">
                          Hidden {item.id}: {item.passed ? "Passed" : "Failed"}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      );
    }
    return (
      <div className="space-y-3">
        {timer ? <div className={`rounded-2xl px-4 py-3 text-sm font-semibold ${timerExpired ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"}`}>{timerExpired ? "Question timer ended" : `Question timer: ${String(Math.floor(timer.remainingSeconds / 60)).padStart(2, "0")}:${String(timer.remainingSeconds % 60).padStart(2, "0")}`}</div> : null}
        <textarea
          value={value.answer_text}
          onChange={(event) => updateAnswer(link.id, { answer_text: event.target.value })}
          className="min-h-[180px] w-full rounded-2xl border border-slate-200 px-4 py-3"
          placeholder="Write your answer here"
          disabled={inputLocked}
        />
      </div>
    );
  };

  const timeLabel = `${String(Math.floor(timeLeft / 3600)).padStart(2, "0")}:${String(Math.floor((timeLeft % 3600) / 60)).padStart(2, "0")}:${String(timeLeft % 60).padStart(2, "0")}`;

  if (loading) {
    return <div className="rounded-[24px] border border-dashed border-slate-200 px-5 py-10 text-sm text-slate-500">Loading exam workspace...</div>;
  }

  if (!exam) {
    return <div className="rounded-[24px] border border-red-200 bg-red-50 px-5 py-10 text-sm text-red-600">Exam not found.</div>;
  }

  return (
    <div className="space-y-6">
      <section className="erp-card rounded-[32px] px-6 py-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.45em] text-blue-600">{reviewMode ? "Exam Review Workspace" : "Student Exam Workspace"}</p>
            <h1 className="mt-3 text-4xl font-extrabold text-slate-900">{exam.title}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">{exam.instructions}</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-[24px] border border-blue-100 bg-blue-50 px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">Time Left</p>
              <p className="mt-2 text-3xl font-extrabold text-slate-900">{timeLabel}</p>
            </div>
            <div className="rounded-[24px] border border-amber-100 bg-amber-50 px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">Violations</p>
              <p className="mt-2 text-3xl font-extrabold text-slate-900">
                {violationState.blurCount + violationState.visibilityCount + violationState.fullscreenExitCount + violationState.blockedActionCount}
              </p>
            </div>
          </div>
        </div>
      </section>

      {statusMessage && <div className="rounded-3xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-700">{statusMessage}</div>}
      {error && <div className="rounded-3xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-600">{error}</div>}

      {(derivedStatus === "waiting" || (!reviewMode && (!attempt || !attempt.password_verified_at || attempt.status === "not_started"))) ? (
        <section className="erp-card rounded-[30px] p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-blue-600">Wait Room</p>
          <h2 className="mt-3 text-2xl font-extrabold text-slate-900">Exam access checkpoint</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Starts</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{formatDateTime(exam.start_time)}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Ends</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{formatDateTime(exam.end_time)}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Questions</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{exam.question_count || exam.question_links.length}</p>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            {!attempt && <button type="button" onClick={enterWaitRoom} className="rounded-full bg-[#0F5BD8] px-5 py-3 text-sm font-semibold text-white">Enter Wait Room</button>}
            {attempt && !attempt.password_verified_at && (
              <>
                <input value={examPassword} onChange={(event) => setExamPassword(event.target.value)} className="rounded-full border border-slate-200 px-5 py-3 text-sm" placeholder="Enter exam password" />
                <button type="button" onClick={verifyPassword} className="rounded-full bg-[#0F5BD8] px-5 py-3 text-sm font-semibold text-white">Verify Password</button>
              </>
            )}
          </div>

          {attempt?.password_verified_at && derivedStatus === "open" && (
            <div className="mt-6 space-y-5 rounded-[28px] border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-teal-50 p-6">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-600">Pre-Exam Proctor Check</p>
                  <h3 className="mt-2 text-xl font-extrabold text-slate-900">Launch the protected exam room</h3>
                  <p className="mt-2 text-sm leading-7 text-slate-600">Permissions, fullscreen, and live guard rails should be ready before the exam begins.</p>
                </div>
                <button type="button" onClick={launchProtectedMode} className="rounded-full bg-gradient-to-r from-blue-600 to-teal-500 px-5 py-3 text-sm font-semibold text-white">
                  Launch Protected Mode
                </button>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className={`rounded-2xl px-4 py-3 text-sm font-semibold ${permissionState.camera ? "bg-emerald-100 text-emerald-700" : "bg-white text-slate-600"}`}>Camera: {permissionState.camera ? "Granted" : "Pending"}</div>
                <div className={`rounded-2xl px-4 py-3 text-sm font-semibold ${permissionState.microphone ? "bg-emerald-100 text-emerald-700" : "bg-white text-slate-600"}`}>Microphone: {permissionState.microphone ? "Granted" : "Pending"}</div>
                <div className={`rounded-2xl px-4 py-3 text-sm font-semibold ${permissionState.fullscreen ? "bg-emerald-100 text-emerald-700" : "bg-white text-slate-600"}`}>Fullscreen: {permissionState.fullscreen ? "Ready" : "Pending"}</div>
              </div>
              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={requestExamPermissions} className="rounded-full border border-blue-100 bg-white px-5 py-3 text-sm font-semibold text-blue-700">Grant Required Permissions</button>
                <button type="button" onClick={requestFullscreen} className="rounded-full border border-blue-100 bg-white px-5 py-3 text-sm font-semibold text-blue-700">Enter Fullscreen</button>
                <button type="button" onClick={startAttempt} className="rounded-full bg-emerald-600 px-5 py-3 text-sm font-semibold text-white">Start Attempt</button>
              </div>
              {!permissionsChecked && <p className="text-sm text-slate-600">Permissions have not been checked yet. Launch protected mode before starting.</p>}
            </div>
          )}

          {derivedStatus === "waiting" && <p className="mt-5 text-sm text-slate-600">The exam will open only at the scheduled start time.</p>}
        </section>
      ) : (
        <section className="space-y-6">
          {reviewMode && (
            <section className="erp-card rounded-[30px] p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.4em] text-blue-600">{submitted ? "Submission Complete" : "Review Mode"}</p>
              <h2 className="mt-3 text-2xl font-extrabold text-slate-900">{submitted ? "Your attempt is locked" : reviewContentVisible ? "The exam window has ended" : "Review is locked for this exam"}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                {submitted
                  ? `Status: ${attempt.status}. Submitted at ${attempt.submitted_at ? formatDateTime(attempt.submitted_at) : "N/A"}.`
                  : reviewContentVisible
                    ? "This exam is now review-only. Questions stay visible, but answers and executions are locked."
                    : "The exam ended successfully, but the review paper is not released for students."}
              </p>
              {reviewContentVisible && (
                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                    Review paper: <span className="font-semibold text-slate-900">Enabled</span>
                  </div>
                  <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                    Score visibility: <span className="font-semibold text-slate-900">{scoreVisibleInReview ? "Visible" : "Hidden"}</span>
                  </div>
                  <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                    Answer key: <span className="font-semibold text-slate-900">{answerKeyVisibleInReview ? "Visible" : "Hidden"}</span>
                  </div>
                </div>
              )}
              {reviewContentVisible && scoreVisibleInReview && attempt && (
                <div className="mt-5 rounded-[24px] border border-emerald-100 bg-emerald-50 px-5 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Your Score</p>
                  <p className="mt-2 text-3xl font-extrabold text-slate-900">{attempt.score ?? 0} / {attempt.max_score ?? exam.total_marks}</p>
                </div>
              )}
              <div className="mt-5 flex gap-3">
                <button type="button" onClick={() => navigate("/exams")} className="rounded-full bg-[#0F5BD8] px-5 py-3 text-sm font-semibold text-white">Back to Exams</button>
              </div>
            </section>
          )}

          {!reviewMode && (
            <section className="grid gap-4 md:grid-cols-4">
              <div className="rounded-[24px] border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700">Blur: {violationState.blurCount}</div>
              <div className="rounded-[24px] border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700">Hidden tabs: {violationState.visibilityCount}</div>
              <div className="rounded-[24px] border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700">Fullscreen exits: {violationState.fullscreenExitCount}</div>
              <div className="rounded-[24px] border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700">Blocked actions: {violationState.blockedActionCount}</div>
            </section>
          )}

          {reviewContentVisible && <section className="erp-card rounded-[28px] p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-blue-600">Question Navigator</p>
                <h3 className="mt-2 text-xl font-extrabold text-slate-900">Move through the paper quickly</h3>
              </div>
              <div className="text-sm text-slate-500">
                {exam.question_count || exam.question_links.length} questions · {exam.total_marks} marks
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              {exam.question_links.map((link, index) => (
                <a
                  key={link.id}
                  href={`#question-${link.id}`}
                  className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                >
                  Q{index + 1} · {link.question.question_type.toUpperCase()}
                </a>
              ))}
            </div>
          </section>}

          {reviewContentVisible && <section className={`space-y-5 ${screenLocked ? "pointer-events-none select-none opacity-30" : ""}`}>
            {exam.question_links.map((link, index) => (
              <article id={`question-${link.id}`} key={link.id} className="erp-card rounded-[30px] p-6 scroll-mt-24">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-600">Question {index + 1} • {link.question.question_type.toUpperCase()}</p>
                    <h2 className="mt-3 text-2xl font-extrabold text-slate-900">{link.question.title}</h2>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {link.question.question_timer_minutes ? <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">{link.question.question_timer_minutes} min suggested</div> : null}
                    <div className="rounded-2xl bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700">{link.points} marks</div>
                  </div>
                </div>
                {link.question.short_description && <p className="mt-3 text-sm font-medium text-slate-500">{link.question.short_description}</p>}
                {link.question.image_url && (
                  <figure className="mt-5 overflow-hidden rounded-[24px] border border-slate-200 bg-slate-50">
                    <img src={link.question.image_url} alt={link.question.image_caption || link.question.title} className="max-h-[320px] w-full object-contain bg-white" />
                    {link.question.image_caption && <figcaption className="px-4 py-3 text-sm text-slate-500">{link.question.image_caption}</figcaption>}
                  </figure>
                )}
                <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-700">{link.question.prompt}</p>
                {link.question.instructions && <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-500">{link.question.instructions}</p>}
                {reviewMode && answerKeyVisibleInReview && link.question.correct_answers?.length > 0 && (
                  <div className="mt-4 rounded-[22px] border border-emerald-100 bg-emerald-50 px-4 py-4 text-sm text-emerald-800">
                    Correct answer: {link.question.correct_answers.join(", ")}
                  </div>
                )}
                {(link.question.examples || []).length > 0 && (
                  <div className="mt-5 grid gap-3">
                    {(link.question.examples || []).map((example, exampleIndex) => (
                      <div key={`${link.id}-example-${exampleIndex}`} className="rounded-[24px] border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                        <p className="font-semibold text-slate-900">Example {exampleIndex + 1}</p>
                        {example.input && <pre className="mt-3 whitespace-pre-wrap rounded-2xl bg-white px-4 py-3 text-xs text-slate-700">Input: {example.input}</pre>}
                        {example.output && <pre className="mt-3 whitespace-pre-wrap rounded-2xl bg-white px-4 py-3 text-xs text-slate-700">Output: {example.output}</pre>}
                        {example.explanation && <p className="mt-3 text-sm text-slate-600">{example.explanation}</p>}
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-5">{renderQuestionInput(link)}</div>
              </article>
            ))}
          </section>}

          {!reviewMode && (
            <section className="erp-card rounded-[30px] p-6">
              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={() => saveNow(false)} disabled={screenLocked} className="rounded-full border border-blue-100 bg-blue-50 px-5 py-3 text-sm font-semibold text-blue-700 disabled:opacity-60">Save Progress</button>
                <button type="button" onClick={submitExam} disabled={screenLocked} className="rounded-full bg-[#0F5BD8] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">Submit Exam</button>
              </div>
            </section>
          )}
        </section>
      )}

      <video ref={webcamVideoRef} autoPlay playsInline muted className="hidden" />

      {screenLocked && !submitted && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 backdrop-blur-sm">
          <div className="erp-card w-full max-w-2xl rounded-[32px] p-8 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.4em] text-rose-600">Protected Exam Session</p>
            <h3 className="mt-3 text-3xl font-extrabold text-slate-900">Exam screen locked</h3>
            <p className="mt-4 text-sm leading-7 text-slate-600">
              A proctoring rule was triggered. Questions are hidden until you return to the protected workspace.
            </p>
            <div className="mt-5 rounded-[24px] border border-blue-100 bg-blue-50/70 p-5 text-left text-sm text-slate-700">
              <p className="font-semibold text-slate-900">Current enforcement</p>
              <p className="mt-2">Fullscreen is required. Exiting fullscreen or leaving the tab records a violation.</p>
              <p className="mt-2">If fullscreen is not restored within {proctorSettings.fullscreenRecoverySeconds || 10} seconds, the session logs out automatically.</p>
            </div>
            <div className="mt-5 rounded-[24px] border border-rose-100 bg-rose-50 px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-700">Recovery timer</p>
              <p className="mt-2 text-4xl font-extrabold text-slate-900">{String(fullscreenTimer).padStart(2, "0")}s</p>
            </div>
            <div className="mt-6 flex justify-center gap-3">
              <button type="button" onClick={requestFullscreen} className="rounded-full bg-gradient-to-r from-blue-600 to-teal-500 px-6 py-3 text-sm font-bold text-white">
                Enter Fullscreen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExamWorkspace;
