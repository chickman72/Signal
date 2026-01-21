"use client";

import { useEffect, useState } from "react";
import TutorChat from "../../components/TutorChat";
import { initializeTutorSession } from "../actions/tutor";
import { getCourseDetails } from "../actions/courses";

type ChatSession = {
  id: string;
  courseId: string;
};

export default function TutorPage() {
  const [session, setSession] = useState<ChatSession | null>(null);
  const [initialMessage, setInitialMessage] = useState<string | null>(null);
  const [starterPrompts, setStarterPrompts] = useState<string[]>([]);
  const [courseInfo, setCourseInfo] = useState<{ id: string; title?: string } | null>(null);
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
        const kickoff = await initializeTutorSession(courseId, studentName);
        const course = await getCourseDetails(courseId);
        if (isMounted) {
          setSession({ id: kickoff.sessionId, courseId });
          setInitialMessage(kickoff.initialMessage);
        }
        if (isMounted && course?.starterPrompts) {
          setStarterPrompts(course.starterPrompts);
        }
        if (isMounted) {
          setCourseInfo({
            id: courseId,
            title: course?.title,
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
      <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-6">
        <p className="text-sm text-rose-300">{error}</p>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-6">
        <p className="text-sm text-slate-400">Loading Preceptor...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex w-full max-w-4xl flex-col px-6 py-10">
        <header className="mb-8">
          <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Tutor</p>
          <h1 className="text-2xl font-semibold text-slate-50">
            {courseInfo?.title || "Nursing Preceptor"}
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Ask questions, reflect on clinical concepts, and receive targeted coaching.
          </p>
          <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-400">
            <span className="rounded-full border border-slate-800 bg-slate-900/60 px-3 py-1">
              Course ID: {courseInfo?.id ?? session.courseId}
            </span>
            <span className="rounded-full border border-slate-800 bg-slate-900/60 px-3 py-1">
              Session: {session.id}
            </span>
          </div>
        </header>
        <TutorChat
          sessionId={session.id}
          courseId={session.courseId}
          starterPrompts={starterPrompts}
          initialMessage={initialMessage ?? undefined}
        />
      </div>
    </main>
  );
}
