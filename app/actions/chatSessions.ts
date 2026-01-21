"use server";

import crypto from "crypto";
import { getChatSessionsContainer } from "../lib/db";
import { logEvent } from "../dbActions";

export async function createChatSession(courseId: string, studentName?: string) {
  if (!courseId) throw new Error("courseId is required.");

  const container = await getChatSessionsContainer();
  const now = new Date().toISOString();
  const session = {
    id: crypto.randomUUID(),
    courseId,
    studentName: studentName?.trim() || undefined,
    messages: [],
    createdAt: now,
    lastUpdated: now,
  };

  await container.items.create(session);
  await logEvent("tutor_session_start", {
    user: session.id,
    courseId,
    sessionId: session.id,
    request: { courseId },
  });
  return session;
}
