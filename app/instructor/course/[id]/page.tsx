import Link from "next/link";
import { getInstructorCoursesContainer } from "../../../lib/db";
import InstructorGuard from "../../InstructorGuard";
import { getCourseMetrics, getSessionTrends } from "../../../actions/analytics";
import GapChart from "./GapChart";
import ChatInsights from "./ChatInsights";
import SessionTrendsChart from "./SessionTrendsChart";

async function fetchCourse(id: string, instructorId: string) {
  const container = await getInstructorCoursesContainer();
  const { resource } = await container.item(id, instructorId).read();
  return resource as {
    id: string;
    title: string;
    description?: string;
    tutorMode: 'simulation' | 'course_tutor';
    systemPrompt: string;
    starterPrompts: string[];
    instructorId: string;
  } | undefined;
}

export default async function CourseEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ instructorId?: string }>;
}) {
  const resolvedParams = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const instructorId = resolvedSearchParams?.instructorId ?? "default-instructor";
  const isNew = resolvedParams.id === "new";
  const course = isNew ? undefined : await fetchCourse(resolvedParams.id, instructorId);

  const courseId = course?.id;
  const metrics = courseId ? await getCourseMetrics(courseId) : null;
  const sessionTrends = courseId ? await getSessionTrends(courseId) : null;
  const engagementScore = metrics?.averageMessagesPerSession ?? 0;
  const confusionRate = metrics?.interactionsCount
    ? Math.round((metrics.knowledgeGapCount / metrics.interactionsCount) * 100)
    : 0;

  const confusionTone =
    confusionRate > 20
      ? "text-rose-700 border-rose-500/40 bg-rose-500/10"
      : confusionRate > 10
      ? "text-amber-700 border-amber-500/40 bg-amber-500/10"
      : "text-emerald-700 border-emerald-500/40 bg-emerald-500/10";
  const engagementTone =
    engagementScore >= 6
      ? "text-emerald-700 border-emerald-500/40 bg-emerald-500/10"
      : engagementScore >= 4
      ? "text-amber-700 border-amber-500/40 bg-amber-500/10"
      : "text-rose-700 border-rose-500/40 bg-rose-500/10";

  return (
    <InstructorGuard>
      <main className="min-h-screen bg-slate-50 text-slate-900">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12 lg:gap-10">
          <header className="flex flex-col gap-3">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-600">
              Course Command Center
            </p>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
                <Link
                  href={`/instructor?instructorId=${encodeURIComponent(instructorId)}`}
                  className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-700 hover:text-cyan-700"
                >
                  Back to Courses
                </Link>
                <h1 className="text-2xl font-semibold text-slate-950 sm:text-3xl">
                  {course?.title ?? "Course Dashboard"}
                </h1>
                <p className="text-xs uppercase tracking-[0.25em] text-slate-500">
                  Course Analytics Dashboard
                </p>
              </div>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
                <Link
                  href={`/instructor/course/${encodeURIComponent(
                    resolvedParams.id,
                  )}/settings?instructorId=${encodeURIComponent(instructorId)}`}
                  className="inline-flex items-center justify-center rounded-lg border border-cyan-400/40 bg-cyan-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700 transition hover:bg-cyan-400/20"
                >
                  Edit Settings
                </Link>
                {courseId ? (
                  <a
                    href={`/tutor?courseId=${encodeURIComponent(courseId)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center rounded-lg border border-emerald-400/40 bg-emerald-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700 transition hover:bg-emerald-400/20"
                  >
                    Launch Tutor
                  </a>
                ) : null}
                {courseId ? (
                  <Link
                    href={`/instructor/course/${encodeURIComponent(
                      courseId,
                    )}/logs?instructorId=${encodeURIComponent(instructorId)}`}
                    className="inline-flex items-center justify-center rounded-lg border border-purple-400/40 bg-purple-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-purple-700 transition hover:bg-purple-400/20"
                  >
                    View Chat Logs
                  </Link>
                ) : null}
              </div>
            </div>
            <p className="text-sm text-slate-600 max-w-3xl">
              Scan the vitals, spot knowledge gaps, and decide what to reinforce tomorrow.
            </p>
          </header>

          {isNew || !courseId ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xl shadow-slate-200/80 sm:p-6">
              <h2 className="text-lg font-semibold text-slate-950">Course setup required</h2>
              <p className="mt-2 text-sm text-slate-600">
                Create the course profile before analytics become available.
              </p>
              <Link
                href={`/instructor/course/${encodeURIComponent(
                  resolvedParams.id,
                )}/settings?instructorId=${encodeURIComponent(instructorId)}`}
                className="mt-4 inline-flex items-center rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
              >
                Configure Course
              </Link>
            </section>
          ) : (
            <>
              <section className="grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xl shadow-slate-200/80 sm:p-6">
                  <p className="text-xs uppercase tracking-[0.25em] text-slate-500">
                    Active Students
                  </p>
                  <p className="mt-4 text-3xl font-semibold text-slate-950">
                    {metrics?.studentCount ?? 0}
                  </p>
                  <p className="mt-2 text-xs text-slate-600">
                    Unique learners with recent chat activity.
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xl shadow-slate-200/80 sm:p-6">
                  <p className="text-xs uppercase tracking-[0.25em] text-slate-500">
                    Engagement Score
                  </p>
                  <div
                    className={`mt-4 inline-flex items-center rounded-full border px-3 py-1 text-sm font-semibold ${engagementTone}`}
                  >
                    {engagementScore} avg messages/session
                  </div>
                  <p className="mt-3 text-xs text-slate-600">
                    Higher scores signal deeper tutoring conversations.
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xl shadow-slate-200/80 sm:p-6">
                  <p className="text-xs uppercase tracking-[0.25em] text-slate-500">
                    Confusion Rate
                  </p>
                  <div
                    className={`mt-4 inline-flex items-center rounded-full border px-3 py-1 text-sm font-semibold ${confusionTone}`}
                  >
                    {confusionRate}% knowledge-gap flags
                  </div>
                  <p className="mt-3 text-xs text-slate-600">
                    Escalate when confusion passes 20%.
                  </p>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xl shadow-slate-200/80 sm:p-6">
                <div className="flex flex-col gap-2">
                  <p className="text-xs uppercase tracking-[0.25em] text-slate-500">
                    Session Activity Trends
                  </p>
                  <h2 className="text-lg font-semibold text-slate-950">
                    Sessions Over Time
                  </h2>
                </div>
                <div className="mt-6">
                  {sessionTrends ? (
                    <SessionTrendsChart data={sessionTrends} />
                  ) : (
                    <div className="flex h-64 items-center justify-center text-sm text-slate-600">
                      Loading session trends...
                    </div>
                  )}
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xl shadow-slate-200/80 sm:p-6">
                <div className="flex flex-col gap-2">
                  <p className="text-xs uppercase tracking-[0.25em] text-slate-500">
                    Knowledge Gap Radar
                  </p>
                  <h2 className="text-lg font-semibold text-slate-950">
                    Top Challenging Topics
                  </h2>
                </div>
                <div className="mt-6 grid gap-6 md:grid-cols-[2fr_1fr]">
                  <div className="rounded-xl border border-slate-200 bg-slate-50/30 p-4">
                    {metrics?.gapAnalysis.length ? (
                      <GapChart data={metrics.gapAnalysis} />
                    ) : (
                      <div className="flex h-64 items-center justify-center text-sm text-slate-600">
                        No gap data yet. Start a few tutoring sessions.
                      </div>
                    )}
                  </div>
                  {courseId ? <ChatInsights courseId={courseId} /> : null}
                </div>
              </section>
            </>
          )}
        </div>
      </main>
    </InstructorGuard>
  );
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
