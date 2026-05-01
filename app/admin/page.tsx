export const dynamic = "force-dynamic";

import { getCoursesContainer, getLogsContainer } from "../lib/db";
import UserInsights from "./UserInsights";
import { ActivityLogEntry } from "../types";
import {
  buildTopicMetrics,
  CourseWithOwner,
  ensureUserSummaries,
  formatPercent,
  formatTimestamp,
  getRequestedTopic,
} from "./types";
import OpenAI from "openai";
import ReactMarkdown from "react-markdown";
import UserManager from "./UserManager";
import { fetchUsers } from "../actions/users";
import InstructorGuard from "../instructor/InstructorGuard";

const RECENT_LOG_LIMIT = 80;
const RECENT_COURSE_LIMIT = 80;
const RECENT_TUTOR_LOG_LIMIT = 120;

async function fetchRecentLogs() {
  const container = await getLogsContainer();
  const { resources } = await container.items
    .query({
      query: "SELECT * FROM c ORDER BY c.timestamp DESC OFFSET 0 LIMIT @limit",
      parameters: [{ name: "@limit", value: RECENT_LOG_LIMIT }],
    })
    .fetchAll();
  return (resources ?? []) as ActivityLogEntry[];
}

async function fetchTutorLogs() {
  const container = await getLogsContainer();
  const { resources } = await container.items
    .query({
      query: "SELECT * FROM c WHERE c.eventType IN ('tutor_session_start', 'tutor_chat') ORDER BY c.timestamp DESC OFFSET 0 LIMIT @limit",
      parameters: [{ name: "@limit", value: RECENT_TUTOR_LOG_LIMIT }],
    })
    .fetchAll();
  return (resources ?? []) as ActivityLogEntry[];
}

async function fetchRecentCourses() {
  const container = await getCoursesContainer();
  const { resources } = await container.items
    .query({
      query: "SELECT * FROM c ORDER BY c._ts DESC OFFSET 0 LIMIT @limit",
      parameters: [{ name: "@limit", value: RECENT_COURSE_LIMIT }],
    })
    .fetchAll();
  return (resources ?? []) as CourseWithOwner[];
}

async function generateTutorGapAnalysis(logs: ActivityLogEntry[]) {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!logs.length) return null;
  const openaiModel = process.env.OPENAI_MODEL;
  if (!openaiModel) return null;

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL,
  });

  const samples = logs
    .filter((log) => log.eventType === "tutor_chat")
    .slice(0, 40)
    .map((log) => ({
      user: log.user,
      courseId: log.courseId,
      timestamp: log.timestamp,
      question: log.request?.message,
      answer: log.response?.answer,
    }));

  const prompt = `
You are an educational analyst. Analyze the tutor conversation samples and identify:
1) The top 3-5 knowledge gaps (topic + short rationale).
2) Which courses those gaps appear in (courseId).
3) Suggested remediation strategies.
Respond in concise markdown with headings and bullet points.
`.trim();

  const completion = await openai.chat.completions.create({
    model: openaiModel,
    messages: [
      { role: "system", content: prompt },
      { role: "user", content: JSON.stringify(samples) },
    ],
  });

  return completion.choices[0]?.message?.content ?? null;
}

export default async function AdminDashboard() {
  const hasCosmosConfig =
    Boolean(process.env.COSMOS_ENDPOINT) && Boolean(process.env.COSMOS_KEY);

  if (!hasCosmosConfig) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-950 flex items-center justify-center px-6">
        <div className="max-w-2xl rounded-3xl border border-slate-200 bg-white p-8 text-center space-y-4">
          <p className="text-sm uppercase tracking-[0.3em] text-slate-500">
            Admin Console
          </p>
          <h1 className="text-3xl font-semibold">
            Cosmos DB credentials are missing
          </h1>
          <p className="text-sm text-slate-600">
            Set <code className="rounded bg-white/90 px-1 text-slate-950">COSMOS_ENDPOINT</code> and{" "}
            <code className="rounded bg-white/90 px-1 text-slate-950">COSMOS_KEY</code> in your
            deployment environment before running the admin dashboard.
          </p>
        </div>
      </div>
    );
  }

  const [logs, courses, tutorLogs, users] = await Promise.all([
    fetchRecentLogs(),
    fetchRecentCourses(),
    fetchTutorLogs(),
    fetchUsers(),
  ]);
  const tutorAnalysis = await generateTutorGapAnalysis(tutorLogs);
  const userSummaries = ensureUserSummaries(logs, courses).sort((a, b) => {
    const left = b.lastLoginMs ?? 0;
    const right = a.lastLoginMs ?? 0;
    return left - right;
  });
  const topicMetrics = buildTopicMetrics(logs, courses);

  const loginEvents = logs.filter((log) => log.eventType === "login").slice(0, 6);
  const recentTopicCount = logs.filter((log) => getRequestedTopic(log)).length;

  const tutorChats = tutorLogs.filter((log) => log.eventType === "tutor_chat");
  const tutorSessions = tutorLogs.filter((log) => log.eventType === "tutor_session_start");

  return (
    <InstructorGuard>
      <div className="min-h-screen bg-slate-50 text-slate-950">
        <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6 sm:py-10 lg:space-y-10">
        <header className="space-y-3">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <p className="text-sm uppercase tracking-[0.3em] text-slate-600">
                Admin Console
              </p>
              <h1 className="text-3xl font-bold text-slate-950 sm:text-4xl">
                Learner Signals &amp; Knowledge Gaps
              </h1>
            </div>
            <a
              href="/"
              className="text-xs uppercase tracking-[0.2em] text-emerald-700 hover:text-emerald-700 transition"
            >
              Back to Main
            </a>
          </div>
          <p className="text-slate-600 max-w-3xl">
            Review who is logging in, what they asked to learn, how courses are progressing, and where their quiz results expose potential topic gaps.
          </p>
        </header>

        <section className="grid md:grid-cols-2 gap-4">
          {loginEvents.map((log) => (
            <article
              key={log.id}
              className="p-4 rounded-2xl border border-slate-200 bg-white backdrop-blur"
            >
              <div className="flex items-center justify-between text-xs uppercase text-slate-500 mb-2">
                <span>Login</span>
                <span>{formatTimestamp(log.timestamp)}</span>
              </div>
              <p className="text-lg font-semibold">
                {log.user ?? "anonymous"}
              </p>
              <p className="text-sm text-slate-600 mt-1">
                Session: {log.sessionId ?? "n/a"} • Source: {log.clientMeta?.userAgent ? "client" : "server"}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {topicMetrics
                  .filter((topic) => topic.username === (log.user ?? "anonymous"))
                  .slice(0, 3)
                  .map((topic) => (
                    <span
                      key={`${log.id}-${topic.key}`}
                      className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-700"
                    >
                      {topic.topic}
                    </span>
                  ))}
              </div>
            </article>
          ))}
        </section>

        <section className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold">Topic Progress Metrics</h2>
              <p className="mt-1 text-sm text-slate-600">
                Recent requested topics joined with saved course progress and quiz performance.
              </p>
            </div>
            <span className="text-xs uppercase tracking-[0.2em] text-slate-500">
              {recentTopicCount} topic requests
            </span>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {topicMetrics.slice(0, 12).map((metric) => {
              return (
                <article
                  key={metric.key}
                  className="rounded-2xl border border-slate-200 bg-white p-4"
                >
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                    <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold uppercase tracking-[0.16em] text-slate-500">{metric.status === "active" ? "In progress" : metric.status === "not_started" ? "Not started" : "Requested"}</span>
                    <span>{formatTimestamp(metric.requestedAt)}</span>
                  </div>
                  <p className="text-sm text-slate-800">
                    <span className="font-semibold text-slate-950">
                      {metric.username}
                    </span>{" "}
                    asked for:
                  </p>
                  <p className="mt-1 break-words text-lg font-medium text-emerald-700">
                    {metric.topic}
                  </p>
                  {metric.courseTitle && metric.courseTitle !== metric.topic ? (
                    <p className="mt-1 text-xs text-slate-500">
                      Course: {metric.courseTitle}
                    </p>
                  ) : null}
                  <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                      <dt className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                        Complete
                      </dt>
                      <dd className="mt-1 text-xl font-semibold text-slate-950">
                        {formatPercent(metric.completionPercent)}
                      </dd>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                      <dt className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                        Accuracy
                      </dt>
                      <dd className="mt-1 text-xl font-semibold text-slate-950">
                        {formatPercent(metric.accuracyPercent)}
                      </dd>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                      <dt className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                        Chapters
                      </dt>
                      <dd className="mt-1 text-xl font-semibold text-slate-950">
                        {metric.completedChapters}/{metric.totalChapters || "N/A"}
                      </dd>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                      <dt className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                        Quizzes
                      </dt>
                      <dd className="mt-1 text-xl font-semibold text-slate-950">
                        {metric.quizAttempts}/{metric.totalQuizzes || "N/A"}
                      </dd>
                    </div>
                  </dl>
                </article>
              );
            })}
            {topicMetrics.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
                No topic requests or saved course progress yet.
              </div>
            ) : null}
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">Tutor Access & Questions</h2>
            <span className="text-xs uppercase tracking-[0.2em] text-slate-500">
              {tutorLogs.length} events
            </span>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {tutorSessions.slice(0, 6).map((log) => (
              <article
                key={log.id}
                className="p-4 rounded-2xl border border-slate-200 bg-white"
              >
                <div className="flex items-center justify-between text-xs uppercase text-slate-500 mb-2">
                  <span>Tutor Session</span>
                  <span>{formatTimestamp(log.timestamp)}</span>
                </div>
                <p className="text-lg font-semibold">
                  {log.user ?? "student"}
                </p>
                <p className="text-sm text-slate-600 mt-1">
                  Course: {log.courseId ?? "unknown"} • Session: {log.sessionId ?? "n/a"}
                </p>
              </article>
            ))}
          </div>
          <div className="space-y-4">
            {tutorChats.slice(0, 8).map((log) => (
              <article
                key={log.id}
                className="p-4 rounded-2xl border border-slate-200 bg-white"
              >
                <div className="flex items-center justify-between text-xs uppercase text-slate-500 mb-2">
                  <span>Tutor Chat</span>
                  <span>{formatTimestamp(log.timestamp)}</span>
                </div>
                <p className="text-sm text-slate-600">
                  Student: <span className="text-slate-950">{log.user ?? "unknown"}</span> • Course:{" "}
                  <span className="text-slate-950">{log.courseId ?? "unknown"}</span>
                </p>
                <p className="mt-2 text-sm text-slate-700">
                  <span className="font-semibold text-slate-950">Q:</span>{" "}
                  {log.request?.message ?? "n/a"}
                </p>
                <p className="mt-2 text-sm text-slate-700">
                  <span className="font-semibold text-slate-950">A:</span>{" "}
                  {log.response?.answer ?? "n/a"}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">Tutor Knowledge Gap Analysis</h2>
            <span className="text-xs uppercase tracking-[0.2em] text-slate-500">
              AI summary
            </span>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-800">
            {tutorAnalysis ? (
              <ReactMarkdown>{tutorAnalysis}</ReactMarkdown>
            ) : (
              <p className="text-slate-600">
                Not enough tutor conversations yet to generate a summary.
              </p>
            )}
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">Active Users</h2>
            <span className="text-xs uppercase tracking-[0.2em] text-slate-500">
              {userSummaries.length} users
            </span>
          </div>
          <UserInsights userSummaries={userSummaries} />
        </section>

        <UserManager users={users} />
        </div>
      </div>
    </InstructorGuard>
  );
}
