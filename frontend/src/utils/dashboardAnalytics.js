import { getStoredUser, isPrivilegedRole } from "./roleHelper";
import { readResumeWorkspace } from "./resumeBuilderStorage";
import { readSqlStudyProgress, getSqlCompletionPercent } from "./sqlStudyProgress";
import { getAppNotifications } from "./appNotifications";

const readQuestionStatus = (questionId) => {
  const solved = localStorage.getItem(`practice-solved-${questionId}`) === "true";
  const attempted = localStorage.getItem(`practice-attempted-${questionId}`) === "true";
  return { solved, attempted };
};

export const getDashboardAnalytics = () => {
  const user = getStoredUser();
  const userId = user?.name || user?.role || "guest";
  const resumeWorkspace = readResumeWorkspace(userId);
  const studyProgress = readSqlStudyProgress(userId);
  const notifications = getAppNotifications();
  const practiceQuestionIds = Array.from({ length: 73 }, (_, index) => index + 1);
  const practice = practiceQuestionIds.reduce(
    (accumulator, questionId) => {
      const { solved, attempted } = readQuestionStatus(questionId);
      if (solved) accumulator.solved += 1;
      if (attempted || solved) accumulator.attempted += 1;
      return accumulator;
    },
    { solved: 0, attempted: 0 },
  );

  const profile = resumeWorkspace.profile || {};
  const profileStrength = [
    profile?.basics?.fullName,
    profile?.basics?.email,
    profile?.basics?.phone,
    profile?.summary,
    profile?.education?.[0]?.degree,
    profile?.skills?.[0]?.items,
  ].filter(Boolean).length;

  const recentNotifications = notifications.slice(0, 5);

  return {
    user,
    isPrivileged: isPrivilegedRole(user?.role),
    practice: {
      total: practiceQuestionIds.length,
      solved: practice.solved,
      attempted: practice.attempted,
      unsolved: practiceQuestionIds.length - practice.solved,
    },
    study: {
      completion: getSqlCompletionPercent(studyProgress),
      completedTopics: Array.isArray(studyProgress.completedTopicIds) ? studyProgress.completedTopicIds.length : 0,
      lastTopicId: studyProgress.lastTopicId || "",
    },
    resume: {
      totalResumes: resumeWorkspace.resumes?.length || 0,
      activeResumeName: resumeWorkspace.resumes?.find((resume) => resume.id === resumeWorkspace.activeResumeId)?.name || "No active resume",
      profileStrength,
    },
    activity: recentNotifications,
  };
};
