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
      <div className="rounded-3xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-600">
        No learners have generated courses yet.
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-[220px,1fr]">
      <div className="space-y-2 rounded-3xl border border-slate-200 bg-white p-3">
        {userSummaries.map((summary) => {
          const isActive = summary.username === selected;
          return (
            <button
              key={summary.username}
              onClick={() => setSelected(summary.username)}
              className={`w-full text-left rounded-2xl px-3 py-2 transition ${isActive ? "bg-slate-100" : "hover:bg-white"}`}
            >
              <div className="flex items-center justify-between">
                <span className={`font-semibold ${isActive ? "text-slate-950" : "text-slate-800"}`}>
                  {summary.username}
                </span>
                <span className="text-xs text-slate-500">
                  {summary.courses.length} courses
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Last login: {formatTimestamp(summary.lastLogin)}
              </p>
            </button>
          );
        })}
      </div>

      <div className="min-h-[360px] space-y-5 rounded-3xl border border-slate-200 bg-white p-4 sm:p-5">
        {!selectedSummary && (
          <p className="text-sm text-slate-600">
            Select a user to view their courses, progress, and knowledge gaps.
          </p>
        )}
        {selectedSummary && (
          <>
            <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Learner</p>
                <p className="text-2xl font-semibold">{selectedSummary.username}</p>
              </div>
              <span className="text-xs text-slate-600">
                Last login {formatTimestamp(selectedSummary.lastLogin)}
              </span>
            </header>

            <div className="flex gap-4 flex-wrap text-sm text-slate-600">
              <p>
                Latest request:{" "}
                <span className="text-slate-950">
                  {selectedSummary.lastTopic ?? "N/A"}
                </span>
              </p>
              {selectedSummary.lastSearch && (
                <p>
                  Last search:{" "}
                  <span className="text-slate-950">{selectedSummary.lastSearch}</span>
                </p>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm uppercase tracking-[0.3em] text-slate-500">
                  Courses
                </p>
                <span className="text-xs text-slate-600">
                  {selectedSummary.courses.length} total
                </span>
              </div>
              {selectedSummary.courses.length === 0 ? (
                <p className="text-sm text-slate-600">No courses saved yet.</p>
              ) : (
                <div className="space-y-2">
                  {selectedSummary.courses.map((course) => (
                    <div
                      key={course.course_id}
                      className="rounded-2xl bg-slate-50/30 border border-slate-200 px-3 py-2"
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-950">
                          {course.title}
                        </p>
                        <span className="text-xs text-slate-600">
                          Grade {course.progress?.overallGrade ?? "N/A"}%
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        {course.progress?.percentComplete ?? 0}% complete
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <p className="text-sm uppercase tracking-[0.3em] text-slate-500">
                Knowledge Gaps
              </p>
              {selectedSummary.topGaps.length === 0 ? (
                <p className="text-sm text-slate-600">
                  No gaps detected (all quiz averages ≥ 75%).
                </p>
              ) : (
                <ul className="space-y-2 text-sm text-slate-800">
                  {selectedSummary.topGaps.map((gap) => (
                    <li
                      key={`${gap.courseTitle}-${gap.chapterId}`}
                      className="flex items-start justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-slate-950">{gap.chapterTitle}</p>
                        <p className="text-xs text-slate-500">
                          {gap.courseTitle}
                        </p>
                      </div>
                      <span className="text-amber-700 font-semibold">
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
