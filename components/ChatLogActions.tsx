"use client";

import { useState } from "react";

type Props = {
  sessionId: string;
  courseId: string;
  instructorId: string;
};

export default function ChatLogActions({ sessionId, courseId, instructorId }: Props) {
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm("Delete this chat session? This cannot be undone.")) {
      return;
    }

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/chat-sessions/${encodeURIComponent(sessionId)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as any).error || "Failed to delete session");
      }
      window.location.reload();
    } catch (error) {
      console.error(error);
      alert("Unable to delete session. See console for details.");
      setIsDeleting(false);
    }
  }

  function handleExport() {
    const url = `/api/chat-sessions/${encodeURIComponent(sessionId)}/export`;
    window.open(url, "_blank");
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={handleDelete}
        disabled={isDeleting}
        className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-rose-700 transition hover:border-rose-400 hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isDeleting ? "Deleting..." : "Delete"}
      </button>
      <button
        type="button"
        onClick={handleExport}
        className="rounded-lg border border-cyan-400/40 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-cyan-700 transition hover:bg-cyan-400/20"
      >
        Export (.docx)
      </button>
    </div>
  );
}
