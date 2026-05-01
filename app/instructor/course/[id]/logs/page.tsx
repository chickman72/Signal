import InstructorGuard from "../../../InstructorGuard";
import ChatLogActions from "../../../../../components/ChatLogActions";
import { getChatSessionsContainer } from "../../../../lib/db";

type ChatSession = {
  id: string;
  courseId: string;
  studentName?: string;
  messages?: Array<{ role?: string; content?: string; createdAt?: string }>;
  createdAt?: string;
  lastUpdated?: string;
};

function resolveSince(range: string | undefined) {
  const now = new Date();
  switch (range) {
    case "7d":
      now.setDate(now.getDate() - 7);
      return now.toISOString();
    case "30d":
      now.setDate(now.getDate() - 30);
      return now.toISOString();
    case "90d":
      now.setDate(now.getDate() - 90);
      return now.toISOString();
    default:
      return undefined;
  }
}

async function fetchSessions(courseId: string, since?: string) {
  const container = await getChatSessionsContainer();
  const query = since
    ? "SELECT * FROM c WHERE c.courseId = @courseId AND c.lastUpdated >= @since ORDER BY c.lastUpdated DESC OFFSET 0 LIMIT 200"
    : "SELECT * FROM c WHERE c.courseId = @courseId ORDER BY c.lastUpdated DESC OFFSET 0 LIMIT 200";
  const parameters = since
    ? [
        { name: "@courseId", value: courseId },
        { name: "@since", value: since },
      ]
    : [{ name: "@courseId", value: courseId }];

  const { resources } = await container.items.query({ query, parameters }).fetchAll();
  return (resources ?? []) as ChatSession[];
}

function summarizeMessages(messages: ChatSession["messages"]) {
  const safe = messages ?? [];
  const lastUser = [...safe].reverse().find((msg) => msg.role === "user");
  return lastUser?.content ?? "No messages yet.";
}

export default async function CourseLogsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ instructorId?: string; q?: string; range?: string }>;
}) {
  const resolvedParams = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const instructorId = resolvedSearchParams?.instructorId ?? "default-instructor";
  const query = resolvedSearchParams?.q?.trim() ?? "";
  const range = resolvedSearchParams?.range ?? "30d";
  const since = resolveSince(range);

  const sessions = await fetchSessions(resolvedParams.id, since);
  const filteredSessions = query
    ? sessions.filter((session) => {
        const haystack = [
          session.id,
          session.messages?.map((msg) => msg.content).join(" ") ?? "",
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(query.toLowerCase());
      })
    : sessions;

  return (
    <InstructorGuard>
      <main className="min-h-screen bg-slate-50 text-slate-900">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12 lg:gap-10">
          <header className="flex flex-col gap-2">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-600">
              Instructor Studio
            </p>
            <a
              href={`/instructor/course/${encodeURIComponent(
                resolvedParams.id,
              )}?instructorId=${encodeURIComponent(instructorId)}`}
              className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-700 hover:text-cyan-700"
            >
              Back to Dashboard
            </a>
            <h1 className="text-2xl font-semibold text-slate-950 sm:text-3xl">
              Chat Logs
            </h1>
            <p className="text-sm text-slate-600">
              Raw tutoring session history will appear here.
            </p>
          </header>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xl shadow-slate-200/80 sm:p-6">
            <form method="get" className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
              <input type="hidden" name="instructorId" value={instructorId} />
              <div className="flex flex-col gap-2">
                <label className="text-xs uppercase tracking-[0.2em] text-slate-500">
                  Search
                </label>
                <input
                  name="q"
                  defaultValue={query}
                  placeholder="Search by keyword or session id"
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none sm:w-64"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs uppercase tracking-[0.2em] text-slate-500">
                  Time Range
                </label>
                <select
                  name="range"
                  defaultValue={range}
                  className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-cyan-400 focus:outline-none"
                >
                  <option value="7d">Last 7 days</option>
                  <option value="30d">Last 30 days</option>
                  <option value="90d">Last 90 days</option>
                  <option value="all">All time</option>
                </select>
              </div>
              <button
                type="submit"
                className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
              >
                Apply Filters
              </button>
            </form>
            <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200">
              <div className="grid min-w-[620px] grid-cols-[1.2fr_0.6fr_0.6fr] gap-4 border-b border-slate-200 bg-white px-4 py-3 text-xs uppercase tracking-[0.2em] text-slate-500">
                <span>Session</span>
                <span>Last Updated</span>
                <span>Messages</span>
              </div>
              {filteredSessions.length === 0 ? (
                <div className="px-4 py-8 text-sm text-slate-600">
                  No sessions match those filters yet.
                </div>
              ) : (
                filteredSessions.map((session) => (
                  <details
                    key={session.id}
                    className="border-b border-slate-200 px-4 py-4 text-sm text-slate-800 last:border-b-0"
                  >
                    <summary className="grid min-w-[620px] cursor-pointer grid-cols-[1.2fr_0.6fr_0.6fr] gap-4">
                      <div>
                        <p className="font-semibold text-slate-900">
                          {session.studentName?.trim() || "Student"} · Session {session.id.slice(0, 8)}
                        </p>
                        <p className="mt-1 text-xs text-slate-600">
                          {summarizeMessages(session.messages)}
                        </p>
                      </div>
                      <span className="text-sm text-slate-700">
                        {session.lastUpdated
                          ? new Date(session.lastUpdated).toLocaleString()
                          : "Unknown"}
                      </span>
                      <span className="text-sm text-slate-700">
                        {session.messages?.length ?? 0}
                      </span>
                    </summary>
                    <div className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                      <ChatLogActions
                        sessionId={session.id}
                        courseId={resolvedParams.id}
                        instructorId={instructorId}
                      />
                      {(session.messages ?? []).length === 0 ? (
                        <p className="text-xs text-slate-600">
                          No messages captured for this session yet.
                        </p>
                      ) : (
                        session.messages?.map((message, index) => (
                          <div key={`${session.id}-${index}`} className="space-y-1">
                            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                              {message.role === "assistant" ? "Tutor" : "Student"}{" "}
                              {message.createdAt
                                ? `• ${new Date(message.createdAt).toLocaleString()}`
                                : ""}
                            </div>
                            <p className="text-sm text-slate-900">
                              {message.content || "(empty)"}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </details>
                ))
              )}
            </div>
          </section>
        </div>
      </main>
    </InstructorGuard>
  );
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
