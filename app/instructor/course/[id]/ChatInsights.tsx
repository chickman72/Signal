"use client";

import { useState, useTransition } from "react";
import { generateChatInsights } from "../../../actions/analytics";

type ChatInsightsProps = {
  courseId: string;
};

export default function ChatInsights({ courseId }: ChatInsightsProps) {
  const [summary, setSummary] = useState<string>(
    "Click refresh to analyze the latest chat logs."
  );
  const [isPending, startTransition] = useTransition();

  const handleRefresh = () => {
    startTransition(async () => {
      try {
        const result = await generateChatInsights(courseId);
        setSummary(result.summary);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to generate insights.";
        setSummary(message);
      }
    });
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-[0.25em] text-slate-500">
          Latest Chat Insights
        </p>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={isPending}
          className="rounded-full border border-cyan-400/50 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200 transition hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Refreshing..." : "Refresh"}
        </button>
      </div>
      <p className="mt-4 text-sm text-slate-200 whitespace-pre-line">
        {summary}
      </p>
    </div>
  );
}
