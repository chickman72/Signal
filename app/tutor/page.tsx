"use client";

import { useEffect, useState } from "react";
import TutorChat from "../../components/TutorChat";
import { getCourseDetails } from "../actions/courses";

type ChatSession = {
  id: string;
  courseId: string;
};

export default function TutorPage() {
  const [session, setSession] = useState<ChatSession | null>(null);
  const [starterPrompts, setStarterPrompts] = useState<string[]>([]);
  const [courseInfo, setCourseInfo] = useState<{ id: string; title?: string; description?: string; tutorMode?: 'simulation' | 'course_tutor' } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function initSession() {
      try {
        const params = new URLSearchParams(window.location.search);
        const directCourseId = params.get("courseId");
        const firstKey = params.keys().next().value;
        const courseId = directCourseId || firstKey || "default";
        let studentName: string | undefined;
        const rawUser = localStorage.getItem("signal_user");
        if (rawUser) {
          try {
            const parsedUser = JSON.parse(rawUser) as { username?: string; displayName?: string };
            studentName = parsedUser?.displayName || parsedUser?.username;
          } catch {
            studentName = undefined;
          }
        }
        const kickoffResponse = await fetch("/api/tutor/init", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ courseId, studentName }),
        });
        const kickoff = (await kickoffResponse.json()) as
          | { ok: true; sessionId: string; initialMessage: string }
          | { ok: false; error: string };
        if (!kickoff.ok) {
          throw new Error(kickoff.error);
        }
        const course = await getCourseDetails(courseId);
        if (isMounted) {
          setSession({ id: kickoff.sessionId, courseId });
        }
        if (isMounted && course?.starterPrompts) {
          setStarterPrompts(course.starterPrompts);
        }
        if (isMounted) {
          setCourseInfo({
            id: courseId,
            title: course?.title,
            description: course?.description,
            tutorMode: course?.tutorMode,
          });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to start chat session.";
        if (isMounted) setError(message);
      }
    }

    initSession();
    return () => {
      isMounted = false;
    };
  }, []);

  if (error) {
    return (
      <main className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center px-6">
        <p className="text-sm text-rose-700">{error}</p>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center px-6">
        <p className="text-sm text-slate-600">
          {courseInfo?.tutorMode === 'simulation' ? 'Loading Patient Simulation...' : 'Loading Preceptor...'}
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto flex w-full max-w-4xl flex-col px-4 py-6 sm:px-6 sm:py-10">
        <header className="mb-6 sm:mb-8">
          <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Tutor</p>
          <h1 className="text-xl font-semibold text-slate-950 sm:text-2xl">
            {courseInfo?.title || (courseInfo?.tutorMode === 'simulation' ? "Patient Simulation" : "Nursing Preceptor")}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            {courseInfo?.description || 
             (courseInfo?.tutorMode === 'simulation' 
               ? 'Practice clinical communication by speaking to a simulated patient.'
               : 'Ask questions, reflect on clinical concepts, and receive targeted coaching.')}
          </p>
          <div className="mt-4 flex flex-col gap-2 text-xs text-slate-600 sm:flex-row sm:flex-wrap sm:gap-3">
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 break-all">
              Course ID: {courseInfo?.id ?? session.courseId}
            </span>
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 break-all">
              Session: {session.id}
            </span>
          </div>
        </header>
        <TutorChat
          sessionId={session.id}
          courseId={session.courseId}
          starterPrompts={starterPrompts}
          tutorMode={courseInfo?.tutorMode}
        />
      </div>
    </main>
  );
}
