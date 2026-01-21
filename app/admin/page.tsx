export const dynamic = "force-dynamic";

import { getCoursesContainer, getLogsContainer } from "../lib/db";
import UserInsights from "./UserInsights";
import { ActivityLogEntry } from "../types";
import { CourseWithOwner, formatTimestamp, ensureUserSummaries } from "./types";
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
      <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center px-6">
        <div className="max-w-2xl rounded-3xl border border-white/10 bg-white/5 p-8 text-center space-y-4">
          <p className="text-sm uppercase tracking-[0.3em] text-neutral-500">
            Admin Console
          </p>
          <h1 className="text-3xl font-semibold">
            Cosmos DB credentials are missing
          </h1>
          <p className="text-sm text-neutral-400">
            Set <code className="rounded bg-black/40 px-1 text-white">COSMOS_ENDPOINT</code> and{" "}
            <code className="rounded bg-black/40 px-1 text-white">COSMOS_KEY</code> in your
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

  const loginEvents = logs.filter((log) => log.eventType === "login").slice(0, 6);
  const topicRequests = logs
    .filter(
      (log) =>
        log.eventType === "generate_course" || log.eventType === "search"
    )
    .slice(0, 8);

  const tutorChats = tutorLogs.filter((log) => log.eventType === "tutor_chat");
  const tutorSessions = tutorLogs.filter((log) => log.eventType === "tutor_session_start");

  return (
    <InstructorGuard>
      <div className="min-h-screen bg-neutral-950 text-white">
        <div className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <header className="space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-2">
              <p className="text-sm uppercase tracking-[0.3em] text-neutral-400">
                Admin Console
              </p>
              <h1 className="text-4xl font-bold text-white">
                Learner Signals &amp; Knowledge Gaps
              </h1>
            </div>
            <a
              href="/"
              className="text-xs uppercase tracking-[0.2em] text-emerald-300 hover:text-emerald-200 transition"
            >
              Back to Main
            </a>
          </div>
          <p className="text-neutral-400 max-w-3xl">
            Review who is logging in, what they asked to learn, how courses are progressing, and where their quiz results expose potential topic gaps.
          </p>
        </header>

        <section className="grid md:grid-cols-2 gap-4">
          {loginEvents.map((log) => (
            <article
              key={log.id}
              className="p-4 rounded-2xl border border-white/10 bg-white/5 backdrop-blur"
            >
              <div className="flex items-center justify-between text-xs uppercase text-neutral-500 mb-2">
                <span>Login</span>
                <span>{formatTimestamp(log.timestamp)}</span>
              </div>
              <p className="text-lg font-semibold">
                {log.user ?? "anonymous"}
              </p>
              <p className="text-sm text-neutral-400 mt-1">
                Session: {log.sessionId ?? "n/a"} • Source: {log.clientMeta?.userAgent ? "client" : "server"}
              </p>
            </article>
          ))}
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">Recent Learner Topics</h2>
            <span className="text-xs uppercase tracking-[0.2em] text-neutral-500">
              {topicRequests.length} entries
            </span>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {topicRequests.map((log) => {
              const topic =
                log.request?.topic ??
                (log.request?.query as string | undefined) ??
                ((log as ActivityLogEntry & { query?: string }).query ?? "–");
              return (
                <article
                  key={`${log.id}-${log.eventType}`}
                  className="p-4 border border-white/10 rounded-2xl bg-neutral-900/40"
                >
                  <div className="flex justify-between items-center text-xs text-neutral-400 mb-2">
                    <span>{log.eventType.replace("_", " ").toUpperCase()}</span>
                    <span>{formatTimestamp(log.timestamp)}</span>
                  </div>
                  <p className="text-neutral-200 text-sm">
                    <span className="font-semibold text-white">
                      {log.user ?? "anonymous"}
                    </span>{" "}
                    asked for:
                  </p>
                  <p className="text-lg font-medium text-emerald-300 mt-1 break-words">
                    {topic}
                  </p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">Tutor Access & Questions</h2>
            <span className="text-xs uppercase tracking-[0.2em] text-neutral-500">
              {tutorLogs.length} events
            </span>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {tutorSessions.slice(0, 6).map((log) => (
              <article
                key={log.id}
                className="p-4 rounded-2xl border border-white/10 bg-white/5"
              >
                <div className="flex items-center justify-between text-xs uppercase text-neutral-500 mb-2">
                  <span>Tutor Session</span>
                  <span>{formatTimestamp(log.timestamp)}</span>
                </div>
                <p className="text-lg font-semibold">
                  {log.user ?? "student"}
                </p>
                <p className="text-sm text-neutral-400 mt-1">
                  Course: {log.courseId ?? "unknown"} • Session: {log.sessionId ?? "n/a"}
                </p>
              </article>
            ))}
          </div>
          <div className="space-y-4">
            {tutorChats.slice(0, 8).map((log) => (
              <article
                key={log.id}
                className="p-4 rounded-2xl border border-white/10 bg-neutral-900/50"
              >
                <div className="flex items-center justify-between text-xs uppercase text-neutral-500 mb-2">
                  <span>Tutor Chat</span>
                  <span>{formatTimestamp(log.timestamp)}</span>
                </div>
                <p className="text-sm text-neutral-400">
                  Student: <span className="text-white">{log.user ?? "unknown"}</span> • Course:{" "}
                  <span className="text-white">{log.courseId ?? "unknown"}</span>
                </p>
                <p className="mt-2 text-sm text-neutral-300">
                  <span className="font-semibold text-white">Q:</span>{" "}
                  {log.request?.message ?? "n/a"}
                </p>
                <p className="mt-2 text-sm text-neutral-300">
                  <span className="font-semibold text-white">A:</span>{" "}
                  {log.response?.answer ?? "n/a"}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">Tutor Knowledge Gap Analysis</h2>
            <span className="text-xs uppercase tracking-[0.2em] text-neutral-500">
              AI summary
            </span>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-neutral-200">
            {tutorAnalysis ? (
              <ReactMarkdown>{tutorAnalysis}</ReactMarkdown>
            ) : (
              <p className="text-neutral-400">
                Not enough tutor conversations yet to generate a summary.
              </p>
            )}
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">Active Users</h2>
            <span className="text-xs uppercase tracking-[0.2em] text-neutral-500">
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
