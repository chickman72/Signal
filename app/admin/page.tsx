import { getCoursesContainer, getLogsContainer } from "../lib/db";
import UserInsights from "./UserInsights";
import { ActivityLogEntry } from "../types";
import { CourseWithOwner, formatTimestamp, ensureUserSummaries } from "./types";

const RECENT_LOG_LIMIT = 80;
const RECENT_COURSE_LIMIT = 80;

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

export default async function AdminDashboard() {
  const [logs, courses] = await Promise.all([fetchRecentLogs(), fetchRecentCourses()]);
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

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <div className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <header className="space-y-2">
          <p className="text-sm uppercase tracking-[0.3em] text-neutral-400">
            Admin Console
          </p>
          <h1 className="text-4xl font-bold text-white">
            Learner Signals &amp; Knowledge Gaps
          </h1>
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
            <h2 className="text-2xl font-semibold">Active Users</h2>
            <span className="text-xs uppercase tracking-[0.2em] text-neutral-500">
              {userSummaries.length} users
            </span>
          </div>
          <UserInsights userSummaries={userSummaries} />
        </section>
      </div>
    </div>
  );
}
