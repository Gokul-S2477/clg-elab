import { SQL_STUDY_COURSE, getNextSqlTopicId } from "../data/sqlStudyCourse";

const buildStorageKey = (userId = "guest") => `sql-study-progress:${userId}`;

const getDefaultState = () => ({
  mcqPassed: {},
  practicePassed: {},
  completedTopicIds: [],
  lastTopicId: SQL_STUDY_COURSE.topics[0]?.id ?? null,
});

const recomputeCompleted = (state) => {
  const validTopicIds = new Set(SQL_STUDY_COURSE.topics.map((topic) => topic.id));
  const completedTopicIds = Array.from(new Set(state.completedTopicIds || [])).filter((topicId) => validTopicIds.has(topicId));
  return { ...state, completedTopicIds };
};

export const readSqlStudyProgress = (userId = "guest") => {
  if (typeof window === "undefined") return getDefaultState();
  try {
    const stored = window.localStorage.getItem(buildStorageKey(userId));
    if (!stored) return getDefaultState();
    return recomputeCompleted({ ...getDefaultState(), ...JSON.parse(stored) });
  } catch (error) {
    console.error("Failed to parse SQL study progress", error);
    return getDefaultState();
  }
};

export const saveSqlStudyProgress = (userId = "guest", nextState) => {
  if (typeof window === "undefined") return;
  const normalized = recomputeCompleted({ ...getDefaultState(), ...nextState });
  window.localStorage.setItem(buildStorageKey(userId), JSON.stringify(normalized));
};

export const markSqlTopicVisited = (userId = "guest", topicId) => {
  const current = readSqlStudyProgress(userId);
  const nextState = {
    ...current,
    lastTopicId: topicId,
    completedTopicIds: current.completedTopicIds.includes(topicId)
      ? current.completedTopicIds
      : [...current.completedTopicIds, topicId],
  };
  saveSqlStudyProgress(userId, nextState);
  return nextState;
};

export const markSqlMcqPassed = (userId = "guest", topicId) => {
  return markSqlTopicVisited(userId, topicId);
};

export const markSqlPracticePassed = (userId = "guest", topicId) => {
  const current = readSqlStudyProgress(userId);
  const nextState = {
    ...current,
    practicePassed: { ...current.practicePassed, [topicId]: true },
    completedTopicIds: current.completedTopicIds.includes(topicId)
      ? current.completedTopicIds
      : [...current.completedTopicIds, topicId],
  };
  const computed = recomputeCompleted(nextState);
  if (!computed.lastTopicId || computed.lastTopicId === topicId) {
    computed.lastTopicId = getNextSqlTopicId(topicId) ?? topicId;
  }
  saveSqlStudyProgress(userId, computed);
  return readSqlStudyProgress(userId);
};

export const getSqlCompletionPercent = (progressState) => {
  const total = SQL_STUDY_COURSE.topics.length || 1;
  return Math.round(((progressState?.completedTopicIds?.length ?? 0) / total) * 100);
};

export const isSqlTopicUnlocked = (progressState, topicId) => {
  const topicIndex = SQL_STUDY_COURSE.topics.findIndex((topic) => topic.id === topicId);
  if (topicIndex <= 0) return true;
  const previousTopic = SQL_STUDY_COURSE.topics[topicIndex - 1];
  return Boolean(progressState?.completedTopicIds?.includes(previousTopic.id));
};
