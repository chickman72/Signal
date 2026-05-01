"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveCourseDetails } from "../../actions/courses";

type CourseEditorProps = {
  initialCourse: {
    id?: string;
    title: string;
    description?: string;
    tutorMode?: 'simulation' | 'course_tutor';
    systemPrompt: string;
    starterPrompts: string[];
    instructorId: string;
  };
};

export default function CourseEditor({ initialCourse }: CourseEditorProps) {
  const router = useRouter();
  const [title, setTitle] = useState(initialCourse.title);
  const [description, setDescription] = useState(initialCourse.description ?? "");
  const [tutorMode, setTutorMode] = useState<'simulation' | 'course_tutor'>(initialCourse.tutorMode ?? 'course_tutor');
  const [systemPrompt, setSystemPrompt] = useState(initialCourse.systemPrompt);
  const [starterPrompts, setStarterPrompts] = useState(initialCourse.starterPrompts);
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<string | null>(null);

  function updatePrompt(index: number, value: string) {
    setStarterPrompts((prev) => prev.map((item, idx) => (idx === index ? value : item)));
  }

  function addPrompt() {
    setStarterPrompts((prev) => [...prev, ""]);
  }

  function removePrompt(index: number) {
    setStarterPrompts((prev) => prev.filter((_, idx) => idx !== index));
  }

  function handleSave() {
    setStatus(null);
    startTransition(async () => {
      try {
        const id = await saveCourseDetails({
          id: initialCourse.id,
          title: title.trim(),
          description: description.trim() || undefined,
          tutorMode,
          systemPrompt: systemPrompt.trim(),
          starterPrompts: starterPrompts.map((prompt) => prompt.trim()).filter(Boolean),
          instructorId: initialCourse.instructorId,
        });
        setStatus("Saved.");
        if (!initialCourse.id) {
          router.push(
            `/instructor/course/${id}?instructorId=${encodeURIComponent(
              initialCourse.instructorId,
            )}`,
          );
          router.refresh();
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to save course.";
        setStatus(message);
      }
    });
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xl shadow-slate-200/80 sm:p-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-slate-950">Course Metadata</h2>
        <p className="text-sm text-slate-600">
          Define the tutor persona and starter prompts for this course.
        </p>
      </div>

      <div className="mt-6 grid gap-5">
        <label className="flex flex-col gap-2 text-sm text-slate-700">
          Course Title
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="rounded-lg border border-slate-300 bg-slate-50/60 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
            placeholder="NUR 632: Informatics"
          />
        </label>

        <label className="flex flex-col gap-2 text-sm text-slate-700">
          Short Description
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={2}
            className="rounded-lg border border-slate-300 bg-slate-50/60 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
            placeholder="A brief overview of the course content..."
          />
        </label>

        <label className="flex flex-col gap-2 text-sm text-slate-700">
          Tutor Mode
          <select
            value={tutorMode}
            onChange={(event) => setTutorMode(event.target.value as 'simulation' | 'course_tutor')}
            className="rounded-lg border border-slate-300 bg-slate-50/60 px-3 py-2 text-sm text-slate-900 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
          >
            <option value="course_tutor">Course Tutor</option>
            <option value="simulation">Simulation</option>
          </select>
          <p className="text-xs text-slate-500">
            {tutorMode === 'course_tutor' 
              ? 'Students interact with an AI tutor/professor/preceptor for learning and guidance.'
              : 'Students practice clinical communication by speaking to a simulated patient.'}
          </p>
        </label>

        <label className="flex flex-col gap-2 text-sm text-slate-700">
          System Prompt
          <textarea
            value={systemPrompt}
            onChange={(event) => setSystemPrompt(event.target.value)}
            rows={6}
            className="rounded-lg border border-slate-300 bg-slate-50/60 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
          />
        </label>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-800">Starter Prompts</span>
            <button
              type="button"
              onClick={addPrompt}
              className="rounded-lg border border-slate-300 bg-slate-50/60 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700 hover:border-cyan-500 hover:text-cyan-700"
            >
              Add Prompt
            </button>
          </div>
          {starterPrompts.length === 0 ? (
            <p className="text-xs text-slate-500">No starter prompts yet.</p>
          ) : (
            starterPrompts.map((prompt, index) => (
              <div key={index} className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <input
                  value={prompt}
                  onChange={(event) => updatePrompt(index, event.target.value)}
                  className="flex-1 rounded-lg border border-slate-300 bg-slate-50/60 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
                  placeholder="Add a starter question..."
                />
                <button
                  type="button"
                  onClick={() => removePrompt(index)}
                  className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-rose-700 transition hover:border-rose-400 hover:bg-rose-500/20"
                >
                  Remove
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="w-full rounded-lg bg-cyan-400 px-5 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-600 sm:w-auto"
        >
          {isPending ? "Saving..." : "Save Details"}
        </button>
        {status ? <span className="text-sm text-slate-600">{status}</span> : null}
      </div>
    </section>
  );
}
