'use client';

import { useMemo, useState } from "react";
import { UserSummary, formatTimestamp } from "./types";

interface UserInsightsProps {
  userSummaries: UserSummary[];
}

export default function UserInsights({ userSummaries }: UserInsightsProps) {
  const [selected, setSelected] = useState(userSummaries[0]?.username ?? "");

  const selectedSummary = useMemo(
    () => userSummaries.find((summary) => summary.username === selected) ?? null,
    [selected, userSummaries]
  );

  if (userSummaries.length === 0) {
    return (
      <div className="rounded-3xl border border-white/10 bg-neutral-900/40 p-6 text-center text-sm text-neutral-400">
        No learners have generated courses yet.
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-[220px,1fr]">
      <div className="space-y-2 rounded-3xl border border-white/10 bg-neutral-900/40 p-3">
        {userSummaries.map((summary) => {
          const isActive = summary.username === selected;
          return (
            <button
              key={summary.username}
              onClick={() => setSelected(summary.username)}
              className={`w-full text-left rounded-2xl px-3 py-2 transition ${isActive ? "bg-white/10" : "hover:bg-white/5"}`}
            >
              <div className="flex items-center justify-between">
                <span className={`font-semibold ${isActive ? "text-white" : "text-neutral-200"}`}>
                  {summary.username}
                </span>
                <span className="text-xs text-neutral-500">
                  {summary.courses.length} courses
                </span>
              </div>
              <p className="text-xs text-neutral-500">
                Last login: {formatTimestamp(summary.lastLogin)}
              </p>
            </button>
          );
        })}
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-5 space-y-5 min-h-[360px]">
        {!selectedSummary && (
          <p className="text-sm text-neutral-400">
            Select a user to view their courses, progress, and knowledge gaps.
          </p>
        )}
        {selectedSummary && (
          <>
            <header className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">Learner</p>
                <p className="text-2xl font-semibold">{selectedSummary.username}</p>
              </div>
              <span className="text-xs text-neutral-400">
                Last login {formatTimestamp(selectedSummary.lastLogin)}
              </span>
            </header>

            <div className="flex gap-4 flex-wrap text-sm text-neutral-400">
              <p>
                Latest request:{" "}
                <span className="text-white">
                  {selectedSummary.lastTopic ?? "N/A"}
                </span>
              </p>
              {selectedSummary.lastSearch && (
                <p>
                  Last search:{" "}
                  <span className="text-white">{selectedSummary.lastSearch}</span>
                </p>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm uppercase tracking-[0.3em] text-neutral-500">
                  Courses
                </p>
                <span className="text-xs text-neutral-400">
                  {selectedSummary.courses.length} total
                </span>
              </div>
              {selectedSummary.courses.length === 0 ? (
                <p className="text-sm text-neutral-400">No courses saved yet.</p>
              ) : (
                <div className="space-y-2">
                  {selectedSummary.courses.map((course) => (
                    <div
                      key={course.course_id}
                      className="rounded-2xl bg-neutral-950/30 border border-white/5 px-3 py-2"
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-white">
                          {course.title}
                        </p>
                        <span className="text-xs text-neutral-400">
                          Grade {course.progress?.overallGrade ?? "N/A"}%
                        </span>
                      </div>
                      <p className="text-xs text-neutral-500">
                        {course.progress?.percentComplete ?? 0}% complete
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <p className="text-sm uppercase tracking-[0.3em] text-neutral-500">
                Knowledge Gaps
              </p>
              {selectedSummary.topGaps.length === 0 ? (
                <p className="text-sm text-neutral-400">
                  No gaps detected (all quiz averages ≥ 75%).
                </p>
              ) : (
                <ul className="space-y-2 text-sm text-neutral-200">
                  {selectedSummary.topGaps.map((gap) => (
                    <li
                      key={`${gap.courseTitle}-${gap.chapterId}`}
                      className="flex items-center justify-between"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-white">{gap.chapterTitle}</p>
                        <p className="text-xs text-neutral-500">
                          {gap.courseTitle}
                        </p>
                      </div>
                      <span className="text-amber-300 font-semibold">
                        {gap.scorePercent}%
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
