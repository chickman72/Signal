import Link from "next/link";
import { getInstructorCoursesContainer } from "../lib/db";
import DeleteCourseButton from "./DeleteCourseButton";
import InstructorGuard from "./InstructorGuard";

type InstructorCourseItem = {
  id: string;
  title: string;
  systemPrompt?: string;
  starterPrompts?: string[];
  instructorId: string;
  createdAt?: string;
  lastUpdated?: string;
};

async function fetchCourses(instructorId: string): Promise<InstructorCourseItem[]> {
  const container = await getInstructorCoursesContainer();
  const { resources } = await container.items
    .query({
      query: "SELECT * FROM c WHERE c.instructorId = @instructorId ORDER BY c.lastUpdated DESC",
      parameters: [{ name: "@instructorId", value: instructorId }],
    })
    .fetchAll();
  return resources as InstructorCourseItem[];
}

export default async function InstructorPage({
  searchParams,
}: {
  searchParams?: Promise<{ instructorId?: string }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const instructorId = resolvedSearchParams?.instructorId ?? "default-instructor";
  const courses = await fetchCourses(instructorId);

  return (
    <InstructorGuard>
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 py-12">
        <header className="flex flex-col gap-2">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
            Instructor Studio
          </p>
          <a
            href="/"
            className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-300 hover:text-cyan-200"
          >
            Back to Main
          </a>
          <h1 className="text-3xl font-semibold text-slate-50">Course Library</h1>
          <p className="text-sm text-slate-400">
            Create course personas, prompts, and knowledge bases.
          </p>
        </header>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl shadow-slate-950/40">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-50">Courses</h2>
            <span className="text-xs uppercase tracking-[0.25em] text-slate-500">
              {courses.length} total
            </span>
          </div>
          <div className="mt-4">
            <Link
              href={`/instructor/course/new/settings?instructorId=${encodeURIComponent(instructorId)}`}
              className="inline-flex items-center rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
            >
              Create New Course
            </Link>
          </div>
          <div className="mt-6 overflow-hidden rounded-xl border border-slate-800">
            <div className="grid grid-cols-[1.4fr_0.5fr_0.6fr_0.5fr_0.4fr_0.5fr] gap-4 border-b border-slate-800 bg-slate-900 px-4 py-3 text-xs uppercase tracking-[0.2em] text-slate-500">
              <span>Course Title</span>
              <span>Starter Prompts</span>
              <span>Last Updated</span>
              <span>Settings</span>
              <span>Launch</span>
              <span>Delete</span>
            </div>
            {courses.length === 0 ? (
              <div className="px-4 py-8 text-sm text-slate-400">
                No courses have been created yet.
              </div>
            ) : (
              courses.map((course) => {
                const dateLabel = course.lastUpdated
                  ? new Date(course.lastUpdated).toLocaleString()
                  : "Unknown";
                return (
                  <div
                    key={course.id}
                    className="grid grid-cols-[1.4fr_0.5fr_0.6fr_0.5fr_0.4fr_0.5fr] gap-4 border-b border-slate-800 px-4 py-4 text-sm text-slate-200 last:border-b-0"
                  >
                    <div className="flex flex-col gap-1">
                      <Link
                        href={`/instructor/course/${course.id}?instructorId=${encodeURIComponent(
                          course.instructorId,
                        )}`}
                        className="font-medium text-slate-100 hover:text-cyan-200"
                      >
                        {course.title || "Untitled Course"}
                      </Link>
                    </div>
                    <span className="text-sm text-slate-300">
                      {course.starterPrompts?.length ?? 0}
                    </span>
                    <span className="text-sm text-slate-300">{dateLabel}</span>
                    <Link
                      href={`/instructor/course/${course.id}/settings?instructorId=${encodeURIComponent(
                        course.instructorId,
                      )}`}
                      className="text-xs font-semibold uppercase tracking-wide text-cyan-300 hover:text-cyan-200"
                    >
                      Settings
                    </Link>
                    <a
                      href={`/tutor?courseId=${encodeURIComponent(course.id)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-semibold uppercase tracking-wide text-emerald-300 hover:text-emerald-200"
                    >
                      Open
                    </a>
                    <DeleteCourseButton courseId={course.id} instructorId={course.instructorId} />
                  </div>
                );
              })
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
