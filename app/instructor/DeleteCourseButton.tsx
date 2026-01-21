"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { deleteCourseAndDocumentsAction } from "../actions/courses";

type DeleteCourseButtonProps = {
  courseId: string;
  instructorId: string;
};

const initialState = { ok: true, message: "" };

export default function DeleteCourseButton({ courseId, instructorId }: DeleteCourseButtonProps) {
  const router = useRouter();
  const [state, formAction] = useActionState(deleteCourseAndDocumentsAction, initialState);

  useEffect(() => {
    if (state.ok && state.message) {
      router.refresh();
    }
  }, [state, router]);

  return (
    <form action={formAction} className="flex items-center justify-end">
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="instructorId" value={instructorId} />
      <button
        type="submit"
        className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-rose-200 transition hover:border-rose-400 hover:bg-rose-500/20"
      >
        Delete
      </button>
    </form>
  );
}
