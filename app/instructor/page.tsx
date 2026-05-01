"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import DeleteCourseButton from "./DeleteCourseButton";
import InstructorGuard from "./InstructorGuard";

type InstructorCourseItem = {
  id: string;
  title: string;
  description?: string;
  tutorMode: 'simulation' | 'course_tutor';
  systemPrompt?: string;
  starterPrompts?: string[];
  instructorId: string;
  createdAt?: string;
  lastUpdated?: string;
};

export default function InstructorPage({
  searchParams,
}: {
  searchParams?: Promise<{ instructorId?: string }>;
}) {
  const [courses, setCourses] = useState<InstructorCourseItem[]>([]);
  const [filteredCourses, setFilteredCourses] = useState<InstructorCourseItem[]>([]);
  const [tutorModeFilter, setTutorModeFilter] = useState<'all' | 'simulation' | 'course_tutor'>('all');
  const [loading, setLoading] = useState(true);
  const [instructorId, setInstructorId] = useState<string>("default-instructor");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const resolvedSearchParams = searchParams ? await searchParams : undefined;
        const id = resolvedSearchParams?.instructorId ?? "default-instructor";
        setInstructorId(id);

        const response = await fetch(`/api/instructor/courses?instructorId=${encodeURIComponent(id)}`);
        if (!response.ok) {
          throw new Error('Failed to fetch courses');
        }

        const data = await response.json();
        setCourses(data.courses || []);
        setFilteredCourses(data.courses || []);
      } catch (error) {
        console.error("Failed to fetch courses:", error);
        setError("Failed to load courses. Please check your database configuration.");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [searchParams]);

  useEffect(() => {
    if (tutorModeFilter === 'all') {
      setFilteredCourses(courses);
    } else {
      setFilteredCourses(courses.filter(course => course.tutorMode === tutorModeFilter));
    }
  }, [courses, tutorModeFilter]);

  if (loading) {
    return (
      <InstructorGuard>
        <main className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center">
          <p className="text-sm text-slate-600">Loading courses...</p>
        </main>
      </InstructorGuard>
    );
  }

  if (error) {
    return (
      <InstructorGuard>
        <main className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center px-6">
          <div className="max-w-2xl rounded-3xl border border-slate-200 bg-white p-8 text-center space-y-4">
            <p className="text-sm uppercase tracking-[0.3em] text-slate-500">
              Instructor Studio
            </p>
            <h1 className="text-3xl font-semibold text-rose-700">
              Database Connection Error
            </h1>
            <p className="text-sm text-slate-600">
              {error}
            </p>
            <p className="text-sm text-slate-600">
              Please ensure <code className="rounded bg-white/90 px-1 text-slate-950">COSMOS_ENDPOINT</code> and{" "}
              <code className="rounded bg-white/90 px-1 text-slate-950">COSMOS_KEY</code> are set in your environment.
            </p>
          </div>
        </main>
      </InstructorGuard>
    );
  }

  return (
    <InstructorGuard>
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12 lg:gap-10">
        <header className="flex flex-col gap-2">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-600">
            Instructor Studio
          </p>
          <a
            href="/"
            className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-700 hover:text-cyan-700"
          >
            Back to Main
          </a>
          <h1 className="text-2xl font-semibold text-slate-950 sm:text-3xl">Course Library</h1>
          <p className="text-sm text-slate-600">
            Create course personas, prompts, and knowledge bases.
          </p>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xl shadow-slate-200/80 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-950">Courses</h2>
            <span className="text-xs uppercase tracking-[0.25em] text-slate-500">
              {filteredCourses.length} total
            </span>
          </div>

          {/* Filter Controls */}
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <span className="text-sm text-slate-600">Filter by type:</span>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setTutorModeFilter('all')}
                className={`rounded-lg px-3 py-1 text-xs font-medium transition ${
                  tutorModeFilter === 'all'
                    ? 'bg-cyan-400 text-slate-950'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                All ({courses.length})
              </button>
              <button
                onClick={() => setTutorModeFilter('course_tutor')}
                className={`rounded-lg px-3 py-1 text-xs font-medium transition ${
                  tutorModeFilter === 'course_tutor'
                    ? 'bg-cyan-400 text-slate-950'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Course Tutor ({courses.filter(c => c.tutorMode === 'course_tutor').length})
              </button>
              <button
                onClick={() => setTutorModeFilter('simulation')}
                className={`rounded-lg px-3 py-1 text-xs font-medium transition ${
                  tutorModeFilter === 'simulation'
                    ? 'bg-cyan-400 text-slate-950'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Simulation ({courses.filter(c => c.tutorMode === 'simulation').length})
              </button>
            </div>
          </div>

          <div className="mt-4">
            <Link
              href={`/instructor/course/new/settings?instructorId=${encodeURIComponent(instructorId)}`}
              className="inline-flex w-full items-center justify-center rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 sm:w-auto"
            >
              Create New Course
            </Link>
          </div>
          <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200">
            <div className="grid min-w-[760px] grid-cols-[1.4fr_0.5fr_0.6fr_0.5fr_0.4fr_0.5fr] gap-4 border-b border-slate-200 bg-white px-4 py-3 text-xs uppercase tracking-[0.2em] text-slate-500">
              <span>Course Title</span>
              <span>Starter Prompts</span>
              <span>Last Updated</span>
              <span>Settings</span>
              <span>Launch</span>
              <span>Delete</span>
            </div>
            {filteredCourses.length === 0 ? (
              <div className="px-4 py-8 text-sm text-slate-600">
                {tutorModeFilter === 'all'
                  ? "No courses have been created yet."
                  : `No ${tutorModeFilter === 'simulation' ? 'simulation' : 'course tutor'} courses found.`}
              </div>
            ) : (
              filteredCourses.map((course) => {
                const dateLabel = course.lastUpdated
                  ? new Date(course.lastUpdated).toLocaleString()
                  : "Unknown";
                return (
                  <div
                    key={course.id}
                    className="grid min-w-[760px] grid-cols-[1.4fr_0.5fr_0.6fr_0.5fr_0.4fr_0.5fr] gap-4 border-b border-slate-200 px-4 py-4 text-sm text-slate-800 last:border-b-0"
                  >
                    <div className="flex flex-col gap-1">
                      <Link
                        href={`/instructor/course/${course.id}?instructorId=${encodeURIComponent(
                          course.instructorId,
                        )}`}
                        className="font-medium text-slate-900 hover:text-cyan-700"
                      >
                        {course.title || "Untitled Course"}
                      </Link>
                      {course.description && (
                        <p className="text-xs text-slate-600">{course.description}</p>
                      )}
                      <span className="text-xs text-slate-500 uppercase tracking-wide">
                        {course.tutorMode === 'simulation' ? 'Simulation' : 'Course Tutor'}
                      </span>
                    </div>
                    <span className="text-sm text-slate-700">
                      {course.starterPrompts?.length ?? 0}
                    </span>
                    <span className="text-sm text-slate-700">{dateLabel}</span>
                    <Link
                      href={`/instructor/course/${course.id}/settings?instructorId=${encodeURIComponent(
                        course.instructorId,
                      )}`}
                      className="text-xs font-semibold uppercase tracking-wide text-cyan-700 hover:text-cyan-700"
                    >
                      Settings
                    </Link>
                    <a
                      href={`/tutor?courseId=${encodeURIComponent(course.id)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-semibold uppercase tracking-wide text-emerald-700 hover:text-emerald-700"
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
