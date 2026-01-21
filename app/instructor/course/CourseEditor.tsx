"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveCourseDetails } from "../../actions/courses";

type CourseEditorProps = {
  initialCourse: {
    id?: string;
    title: string;
    systemPrompt: string;
    starterPrompts: string[];
    instructorId: string;
  };
};

export default function CourseEditor({ initialCourse }: CourseEditorProps) {
  const router = useRouter();
  const [title, setTitle] = useState(initialCourse.title);
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
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl shadow-slate-950/40">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-slate-50">Course Metadata</h2>
        <p className="text-sm text-slate-400">
          Define the tutor persona and starter prompts for this course.
        </p>
      </div>

      <div className="mt-6 grid gap-5">
        <label className="flex flex-col gap-2 text-sm text-slate-300">
          Course Title
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
            placeholder="NUR 632: Informatics"
          />
        </label>

        <label className="flex flex-col gap-2 text-sm text-slate-300">
          System Prompt
          <textarea
            value={systemPrompt}
            onChange={(event) => setSystemPrompt(event.target.value)}
            rows={6}
            className="rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
          />
        </label>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-200">Starter Prompts</span>
            <button
              type="button"
              onClick={addPrompt}
              className="rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-300 hover:border-cyan-500 hover:text-cyan-300"
            >
              Add Prompt
            </button>
          </div>
          {starterPrompts.length === 0 ? (
            <p className="text-xs text-slate-500">No starter prompts yet.</p>
          ) : (
            starterPrompts.map((prompt, index) => (
              <div key={index} className="flex items-center gap-3">
                <input
                  value={prompt}
                  onChange={(event) => updatePrompt(index, event.target.value)}
                  className="flex-1 rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
                  placeholder="Add a starter question..."
                />
                <button
                  type="button"
                  onClick={() => removePrompt(index)}
                  className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-rose-200 transition hover:border-rose-400 hover:bg-rose-500/20"
                >
                  Remove
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="mt-6 flex items-center gap-4">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="rounded-lg bg-cyan-400 px-5 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
        >
          {isPending ? "Saving..." : "Save Details"}
        </button>
        {status ? <span className="text-sm text-slate-400">{status}</span> : null}
      </div>
    </section>
  );
}
