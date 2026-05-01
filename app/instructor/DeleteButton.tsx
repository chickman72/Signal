"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { deleteCourseDocumentAction } from "../actions/documents";

type DeleteState = {
  ok: boolean;
  message?: string;
};

const initialState: DeleteState = { ok: true };

type DeleteButtonProps = {
  id: string;
  courseId: string;
  sourcefile: string;
  blobName: string;
};

export default function DeleteButton({
  id,
  courseId,
  sourcefile,
  blobName,
}: DeleteButtonProps) {
  const router = useRouter();
  const [state, formAction] = useActionState(deleteCourseDocumentAction, initialState);

  useEffect(() => {
    if (state.ok && state.message) {
      router.refresh();
    }
  }, [state, router]);

  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="sourcefile" value={sourcefile} />
      <input type="hidden" name="blobName" value={blobName} />
      <button
        type="submit"
        className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-rose-700 transition hover:border-rose-400 hover:bg-rose-500/20"
      >
        Delete
      </button>
      {!state.ok && state.message ? (
        <span className="ml-3 text-xs text-rose-700">{state.message}</span>
      ) : null}
    </form>
  );
}
