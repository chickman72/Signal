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

export function formatTimestamp(value?: string) {
  if (!value) return "Never";
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return value;
  return DATE_FORMATTER.format(parsed);
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
      const topic =
        log.request?.topic ?? (log.request?.query as string | undefined);
      if (topic && (!summary.lastTopicMs || timestampMs > summary.lastTopicMs)) {
        summary.lastTopic = topic;
        summary.lastTopicMs = timestampMs;
      }
    }

    if (log.eventType === "search") {
      const query = (log as ActivityLogEntry & { query?: string }).query;
      const searchTerm = query ?? log.request?.query;
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
