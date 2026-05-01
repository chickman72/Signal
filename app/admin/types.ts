import { ActivityLogEntry, Course } from "../types";

export const DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

export type CourseWithOwner = Course & {
  username?: string;
};

export interface KnowledgeGap {
  courseTitle: string;
  chapterId: number;
  chapterTitle: string;
  scorePercent: number;
}

export interface UserSummary {
  username: string;
  courses: CourseWithOwner[];
  lastLogin?: string;
  lastTopic?: string;
  lastSearch?: string;
  topGaps: KnowledgeGap[];
  lastLoginMs?: number;
  lastTopicMs?: number;
  lastSearchMs?: number;
}

export interface TopicMetric {
  key: string;
  username: string;
  topic: string;
  requestedAt?: string;
  eventType?: ActivityLogEntry["eventType"];
  courseId?: string;
  courseTitle?: string;
  completionPercent: number | null;
  accuracyPercent: number | null;
  completedChapters: number;
  totalChapters: number;
  quizAttempts: number;
  totalQuizzes: number;
  status: "active" | "not_started" | "requested";
}

export function formatTimestamp(value?: string) {
  if (!value) return "Never";
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return value;
  return DATE_FORMATTER.format(parsed);
}

export function formatPercent(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) return "N/A";
  return `${Math.round(value)}%`;
}

function normalizeTopic(value?: string) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getRequestedTopic(log: ActivityLogEntry) {
  const requestTopic =
    log.request?.topic ??
    (log.request?.query as string | undefined) ??
    ((log as ActivityLogEntry & { query?: string }).query as string | undefined);
  return typeof requestTopic === "string" && requestTopic.trim()
    ? requestTopic.trim()
    : undefined;
}

function courseMatchesTopic(course: CourseWithOwner, topic: string) {
  const normalizedTitle = normalizeTopic(course.title);
  const normalizedTopic = normalizeTopic(topic);
  if (!normalizedTitle || !normalizedTopic) return false;
  return (
    normalizedTitle === normalizedTopic ||
    normalizedTitle.includes(normalizedTopic) ||
    normalizedTopic.includes(normalizedTitle)
  );
}

function getCourseAccuracy(course?: CourseWithOwner) {
  if (!course?.progress?.quizScores || !course.chapters?.length) return null;

  let earned = 0;
  let possible = 0;
  course.chapters.forEach((chapter) => {
    const score = course.progress?.quizScores?.[chapter.id];
    if (typeof score !== "number") return;
    earned += score;
    possible += Math.max(chapter.quiz?.length ?? 0, 0);
  });

  if (possible <= 0) return null;
  return Math.round((earned / possible) * 100);
}

function getCourseMetricBase(course?: CourseWithOwner) {
  const completedChapters = course?.progress?.completedChapterIds?.length ?? 0;
  const totalChapters =
    course?.progress?.totalChapters ?? course?.chapters?.length ?? 0;
  const quizAttempts = course?.progress?.quizScores
    ? Object.keys(course.progress.quizScores).length
    : 0;
  const totalQuizzes = course?.chapters?.length ?? totalChapters;

  return {
    completionPercent: course?.progress?.percentComplete ?? null,
    accuracyPercent: getCourseAccuracy(course) ?? course?.progress?.overallGrade ?? null,
    completedChapters,
    totalChapters,
    quizAttempts,
    totalQuizzes,
    status: course
      ? completedChapters > 0
        ? "active"
        : "not_started"
      : "requested",
  } satisfies Pick<
    TopicMetric,
    | "completionPercent"
    | "accuracyPercent"
    | "completedChapters"
    | "totalChapters"
    | "quizAttempts"
    | "totalQuizzes"
    | "status"
  >;
}

export function buildTopicMetrics(
  logs: ActivityLogEntry[],
  courses: CourseWithOwner[],
): TopicMetric[] {
  const coursesById = new Map<string, CourseWithOwner>();
  courses.forEach((course) => {
    if (course.course_id) coursesById.set(course.course_id, course);
    if ((course as CourseWithOwner & { id?: string }).id) {
      coursesById.set((course as CourseWithOwner & { id?: string }).id!, course);
    }
  });

  const seen = new Set<string>();
  const metrics: TopicMetric[] = [];

  logs
    .filter((log) => log.eventType === "generate_course" || log.eventType === "search")
    .forEach((log) => {
      const topic = getRequestedTopic(log);
      if (!topic) return;

      const username = log.user || "anonymous";
      const directCourse = log.courseId ? coursesById.get(log.courseId) : undefined;
      const matchedCourse =
        directCourse ??
        courses.find(
          (course) =>
            (course.username || "anonymous") === username &&
            courseMatchesTopic(course, topic),
        );
      const courseId = matchedCourse?.course_id ?? log.courseId;
      const key = `${username}:${normalizeTopic(topic)}:${courseId ?? log.id}`;
      if (seen.has(key)) return;
      seen.add(key);

      metrics.push({
        key,
        username,
        topic,
        requestedAt: log.timestamp,
        eventType: log.eventType,
        courseId,
        courseTitle: matchedCourse?.title,
        ...getCourseMetricBase(matchedCourse),
      });
    });

  courses.forEach((course) => {
    const username = course.username || "anonymous";
    const key = `${username}:${normalizeTopic(course.title)}:${course.course_id}`;
    if (seen.has(key)) return;
    seen.add(key);

    metrics.push({
      key,
      username,
      topic: course.title,
      courseId: course.course_id,
      courseTitle: course.title,
      ...getCourseMetricBase(course),
    });
  });

  return metrics.sort((a, b) => {
    const left = Date.parse(a.requestedAt ?? "") || 0;
    const right = Date.parse(b.requestedAt ?? "") || 0;
    return right - left;
  });
}

export function computeKnowledgeGaps(courses: CourseWithOwner[]): KnowledgeGap[] {
  const collector: KnowledgeGap[] = [];

  courses.forEach((course) => {
    const progress = course.progress;
    if (!progress || !course.chapters?.length) return;

    course.chapters.forEach((chapter) => {
      const rawScore = progress.quizScores?.[chapter.id];
      if (typeof rawScore !== "number") return;

      const quizLength = Math.max(chapter.quiz?.length ?? 1, 1);
      const scorePercent = Math.round((rawScore / quizLength) * 100);
      if (scorePercent >= 75) return;

      collector.push({
        courseTitle: course.title,
        chapterId: chapter.id,
        chapterTitle: chapter.title,
        scorePercent,
      });
    });
  });

  return collector
    .sort((a, b) => a.scorePercent - b.scorePercent)
    .slice(0, 3);
}

export function ensureUserSummaries(logs: ActivityLogEntry[], courses: CourseWithOwner[]): UserSummary[] {
  const map = new Map<string, UserSummary>();

  const ensureUser = (username: string) => {
    const key = username || "anonymous";
    if (!map.has(key)) {
      map.set(key, {
        username: key,
        courses: [],
        topGaps: [],
      });
    }
    return map.get(key)!;
  };

  courses.forEach((course) => {
    const owner = course.username || "anonymous";
    const summary = ensureUser(owner);
    summary.courses.push(course);
  });

  logs.forEach((log) => {
    const owner = log.user || "anonymous";
    const summary = ensureUser(owner);
    const timestampMs = Date.parse(log.timestamp ?? "") || 0;

    if (log.eventType === "login") {
      if (!summary.lastLoginMs || timestampMs > summary.lastLoginMs) {
        summary.lastLogin = log.timestamp;
        summary.lastLoginMs = timestampMs;
      }
    }

    if (log.eventType === "generate_course") {
      const topic = getRequestedTopic(log);
      if (topic && (!summary.lastTopicMs || timestampMs > summary.lastTopicMs)) {
        summary.lastTopic = topic;
        summary.lastTopicMs = timestampMs;
      }
    }

    if (log.eventType === "search") {
      const searchTerm = getRequestedTopic(log);
      if (searchTerm && (!summary.lastSearchMs || timestampMs > summary.lastSearchMs)) {
        summary.lastSearch = searchTerm;
        summary.lastSearchMs = timestampMs;
      }
    }
  });

  return Array.from(map.values()).map((summary) => ({
    ...summary,
    topGaps: computeKnowledgeGaps(summary.courses),
  }));
}
