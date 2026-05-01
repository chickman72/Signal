"use client";

import { useMemo, useState } from "react";

type ShareLinkProps = {
  courseId: string;
};

export default function ShareLink({ courseId }: ShareLinkProps) {
  const [copied, setCopied] = useState(false);
  const link = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/tutor?courseId=${encodeURIComponent(courseId)}`;
  }, [courseId]);

  async function handleCopy() {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Share Link</p>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          readOnly
          value={link || "Loading link..."}
          className="w-full flex-1 rounded-lg border border-slate-300 bg-slate-50/60 px-3 py-2 text-xs text-slate-700"
        />
        <button
          type="button"
          onClick={handleCopy}
          className="w-full rounded-lg bg-cyan-400 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-950 transition hover:bg-cyan-300 sm:w-auto"
        >
          {copied ? "Copied" : "Copy URL"}
        </button>
      </div>
      <p className="text-xs text-slate-500">
        Share this link with students to launch the tutor scoped to this course.
      </p>
    </div>
  );
}
