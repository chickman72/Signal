import Link from "next/link";
import { getInstructorCoursesContainer } from "../../../lib/db";
import InstructorGuard from "../../InstructorGuard";
import { getCourseMetrics } from "../../../actions/analytics";
import GapChart from "./GapChart";
import ChatInsights from "./ChatInsights";

async function fetchCourse(id: string, instructorId: string) {
  const container = await getInstructorCoursesContainer();
  const { resource } = await container.item(id, instructorId).read();
  return resource as {
    id: string;
    title: string;
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
  const engagementScore = metrics?.averageMessagesPerSession ?? 0;
  const confusionRate = metrics?.interactionsCount
    ? Math.round((metrics.knowledgeGapCount / metrics.interactionsCount) * 100)
    : 0;

  const confusionTone =
    confusionRate > 20
      ? "text-rose-300 border-rose-500/40 bg-rose-500/10"
      : confusionRate > 10
      ? "text-amber-300 border-amber-500/40 bg-amber-500/10"
      : "text-emerald-300 border-emerald-500/40 bg-emerald-500/10";
  const engagementTone =
    engagementScore >= 6
      ? "text-emerald-300 border-emerald-500/40 bg-emerald-500/10"
      : engagementScore >= 4
      ? "text-amber-300 border-amber-500/40 bg-amber-500/10"
      : "text-rose-300 border-rose-500/40 bg-rose-500/10";

  return (
    <InstructorGuard>
      <main className="min-h-screen bg-slate-950 text-slate-100">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-12">
          <header className="flex flex-col gap-3">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
              Course Command Center
            </p>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
                <Link
                  href={`/instructor?instructorId=${encodeURIComponent(instructorId)}`}
                  className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-300 hover:text-cyan-200"
                >
                  Back to Courses
                </Link>
                <h1 className="text-3xl font-semibold text-slate-50">
                  {course?.title ?? "Course Dashboard"}
                </h1>
                <p className="text-xs uppercase tracking-[0.25em] text-slate-500">
                  Course Analytics Dashboard
                </p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <Link
                  href={`/instructor/course/${encodeURIComponent(
                    resolvedParams.id,
                  )}/settings?instructorId=${encodeURIComponent(instructorId)}`}
                  className="inline-flex items-center rounded-lg border border-cyan-400/40 bg-cyan-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200 transition hover:bg-cyan-400/20"
                >
                  Edit Settings
                </Link>
                {courseId ? (
                  <a
                    href={`/tutor?courseId=${encodeURIComponent(courseId)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center rounded-lg border border-emerald-400/40 bg-emerald-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200 transition hover:bg-emerald-400/20"
                  >
                    Launch Tutor
                  </a>
                ) : null}
              </div>
            </div>
            <p className="text-sm text-slate-400 max-w-3xl">
              Scan the vitals, spot knowledge gaps, and decide what to reinforce tomorrow.
            </p>
          </header>

          {isNew || !courseId ? (
            <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl shadow-slate-950/40">
              <h2 className="text-lg font-semibold text-slate-50">Course setup required</h2>
              <p className="mt-2 text-sm text-slate-400">
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
                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl shadow-slate-950/40">
                  <p className="text-xs uppercase tracking-[0.25em] text-slate-500">
                    Active Students
                  </p>
                  <p className="mt-4 text-3xl font-semibold text-slate-50">
                    {metrics?.studentCount ?? 0}
                  </p>
                  <p className="mt-2 text-xs text-slate-400">
                    Unique learners with recent chat activity.
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl shadow-slate-950/40">
                  <p className="text-xs uppercase tracking-[0.25em] text-slate-500">
                    Engagement Score
                  </p>
                  <div
                    className={`mt-4 inline-flex items-center rounded-full border px-3 py-1 text-sm font-semibold ${engagementTone}`}
                  >
                    {engagementScore} avg messages/session
                  </div>
                  <p className="mt-3 text-xs text-slate-400">
                    Higher scores signal deeper tutoring conversations.
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl shadow-slate-950/40">
                  <p className="text-xs uppercase tracking-[0.25em] text-slate-500">
                    Confusion Rate
                  </p>
                  <div
                    className={`mt-4 inline-flex items-center rounded-full border px-3 py-1 text-sm font-semibold ${confusionTone}`}
                  >
                    {confusionRate}% knowledge-gap flags
                  </div>
                  <p className="mt-3 text-xs text-slate-400">
                    Escalate when confusion passes 20%.
                  </p>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl shadow-slate-950/40">
                <div className="flex flex-col gap-2">
                  <p className="text-xs uppercase tracking-[0.25em] text-slate-500">
                    Knowledge Gap Radar
                  </p>
                  <h2 className="text-lg font-semibold text-slate-50">
                    Top Challenging Topics
                  </h2>
                </div>
                <div className="mt-6 grid gap-6 md:grid-cols-[2fr_1fr]">
                  <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-4">
                    {metrics?.gapAnalysis.length ? (
                      <GapChart data={metrics.gapAnalysis} />
                    ) : (
                      <div className="flex h-64 items-center justify-center text-sm text-slate-400">
                        No gap data yet. Start a few tutoring sessions.
                      </div>
                    )}
                  </div>
                  {courseId ? <ChatInsights courseId={courseId} /> : null}
                </div>
              </section>

              <section className="grid gap-4 md:grid-cols-3">
                <Link
                  href={`/instructor/course/${encodeURIComponent(
                    courseId,
                  )}/settings?instructorId=${encodeURIComponent(
                    instructorId,
                  )}#knowledge-base`}
                  className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-left shadow-xl shadow-slate-950/40 transition hover:border-emerald-400/50"
                >
                  <p className="text-xs uppercase tracking-[0.25em] text-slate-500">
                    Quick Action
                  </p>
                  <h3 className="mt-3 text-lg font-semibold text-slate-100">
                    Manage Knowledge Base
                  </h3>
                  <p className="mt-2 text-sm text-slate-400">
                    Upload PDFs and curate trusted resources.
                  </p>
                </Link>
                <Link
                  href={`/instructor/course/${encodeURIComponent(
                    courseId,
                  )}/settings?instructorId=${encodeURIComponent(
                    instructorId,
                  )}#tutor-persona`}
                  className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-left shadow-xl shadow-slate-950/40 transition hover:border-amber-400/50"
                >
                  <p className="text-xs uppercase tracking-[0.25em] text-slate-500">
                    Quick Action
                  </p>
                  <h3 className="mt-3 text-lg font-semibold text-slate-100">
                    Configure Tutor Persona
                  </h3>
                  <p className="mt-2 text-sm text-slate-400">
                    Refine tone, prompts, and safety guidance.
                  </p>
                </Link>
                <Link
                  href={`/instructor/course/${encodeURIComponent(
                    courseId,
                  )}/logs?instructorId=${encodeURIComponent(instructorId)}`}
                  className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-left shadow-xl shadow-slate-950/40 transition hover:border-cyan-400/50"
                >
                  <p className="text-xs uppercase tracking-[0.25em] text-slate-500">
                    Quick Action
                  </p>
                  <h3 className="mt-3 text-lg font-semibold text-slate-100">
                    View Chat Logs
                  </h3>
                  <p className="mt-2 text-sm text-slate-400">
                    Drill into raw sessions and sentiment trends.
                  </p>
                </Link>
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
