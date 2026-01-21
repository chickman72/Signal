"use server";

import { getChatSessionsContainer, getLogsContainer } from "../lib/db";
import type { ActivityLogEntry } from "../types";
import OpenAI from "openai";

type GapAnalysisItem = {
  topic: string;
  count: number;
};

type RecentAlert = {
  studentName: string;
  topic: string;
  time: string;
};

type ChatSession = {
  id: string;
  courseId: string;
  messages?: Array<{ role?: string; content?: string; createdAt?: string }>;
  createdAt?: string;
  lastUpdated?: string;
};

const openaiModel = process.env.OPENAI_MODEL ?? "";
let openaiClient: OpenAI | null = null;

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey,
      baseURL: process.env.OPENAI_BASE_URL,
    });
  }
  return openaiClient;
}

const TOPIC_RULES: Array<{ topic: string; pattern: RegExp }> = [
  { topic: "Renal", pattern: /\brenal|\bkidney|\bcreatinine|\bneph/i },
  { topic: "Cardiac", pattern: /\bcardiac|\bhear|\bmi\b|\bekg|\becg|\barrhythm/i },
  { topic: "Respiratory", pattern: /\blung|\brespir|\bspo2|\boxygen|\bventil/i },
  { topic: "Sepsis", pattern: /\bsepsis|\bseptic|\bshock/i },
  { topic: "Endocrine", pattern: /\bendocr|\binsulin|\bglucose|\bdiabet/i },
  { topic: "Neuro", pattern: /\bneuro|\bseizure|\bstroke|\bcranial/i },
  { topic: "Pharmacology", pattern: /\bmed\b|\bdrug|\bdosage|\bdose|\bmedicat/i },
  { topic: "Fluids", pattern: /\bfluid|\biv\b|\bsaline|\bdehydrat/i },
];

function extractTopic(text: string | undefined) {
  const normalized = (text ?? "").toLowerCase();
  for (const rule of TOPIC_RULES) {
    if (rule.pattern.test(normalized)) return rule.topic;
  }
  return "General";
}

function isKnowledgeGap(log: ActivityLogEntry) {
  const answer = String(log.response?.answer ?? "");
  const question = String(log.request?.message ?? "");
  const combined = `${answer} ${question}`;
  return /knowledge gap|confus|not sure|uncertain|doesn.t understand/i.test(combined);
}

function formatStudentName(sessionId: string | undefined) {
  if (!sessionId) return "Unknown";
  return `Session ${sessionId.slice(0, 8)}`;
}

function formatTimeLabel(timestamp?: string) {
  if (!timestamp) return "Unknown time";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  return date.toLocaleString();
}

export async function getCourseMetrics(courseId: string): Promise<{
  studentCount: number;
  gapAnalysis: GapAnalysisItem[];
  recentAlerts: RecentAlert[];
  averageMessagesPerSession: number;
  interactionsCount: number;
  knowledgeGapCount: number;
}> {
  if (!courseId) {
    return {
      studentCount: 0,
      gapAnalysis: [],
      recentAlerts: [],
      averageMessagesPerSession: 0,
      interactionsCount: 0,
      knowledgeGapCount: 0,
    };
  }

  const sessionsContainer = await getChatSessionsContainer();
  const logsContainer = await getLogsContainer();

  const [{ resources: sessions }, { resources: logs }] = await Promise.all([
    sessionsContainer.items
      .query({
        query:
          "SELECT * FROM c WHERE c.courseId = @courseId ORDER BY c.lastUpdated DESC OFFSET 0 LIMIT 200",
        parameters: [{ name: "@courseId", value: courseId }],
      })
      .fetchAll(),
    logsContainer.items
      .query({
        query:
          "SELECT * FROM c WHERE c.courseId = @courseId AND c.eventType = 'tutor_chat' ORDER BY c.timestamp DESC OFFSET 0 LIMIT 300",
        parameters: [{ name: "@courseId", value: courseId }],
      })
      .fetchAll(),
  ]);

  const chatSessions = (sessions ?? []) as ChatSession[];
  const tutorLogs = (logs ?? []) as ActivityLogEntry[];

  const studentIds = new Set<string>();
  let totalMessages = 0;

  for (const session of chatSessions) {
    studentIds.add(session.id);
    totalMessages += session.messages?.length ?? 0;
  }

  const interactionsCount = tutorLogs.length;
  const knowledgeGapCount = tutorLogs.filter(isKnowledgeGap).length;

  const topicCounts = new Map<string, number>();
  for (const log of tutorLogs) {
    const topic = extractTopic(String(log.request?.message ?? ""));
    topicCounts.set(topic, (topicCounts.get(topic) ?? 0) + 1);
  }

  const gapAnalysis = Array.from(topicCounts.entries())
    .map(([topic, count]) => ({ topic, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  const recentAlerts = tutorLogs
    .filter(isKnowledgeGap)
    .slice(0, 6)
    .map((log) => ({
      studentName: formatStudentName(log.sessionId || log.user),
      topic: extractTopic(String(log.request?.message ?? "")),
      time: formatTimeLabel(log.timestamp),
    }));

  return {
    studentCount: studentIds.size,
    gapAnalysis,
    recentAlerts,
    averageMessagesPerSession: chatSessions.length
      ? Number((totalMessages / chatSessions.length).toFixed(1))
      : 0,
    interactionsCount,
    knowledgeGapCount,
  };
}

export async function generateChatInsights(courseId: string) {
  if (!courseId) throw new Error("courseId is required.");
  const client = getOpenAIClient();
  if (!client || !openaiModel) {
    return {
      ok: false,
      summary: "AI summary is unavailable. Missing OpenAI configuration.",
    };
  }

  const logsContainer = await getLogsContainer();
  const { resources } = await logsContainer.items
    .query({
      query:
        "SELECT * FROM c WHERE c.courseId = @courseId AND c.eventType = 'tutor_chat' ORDER BY c.timestamp DESC OFFSET 0 LIMIT 120",
      parameters: [{ name: "@courseId", value: courseId }],
    })
    .fetchAll();

  const tutorLogs = (resources ?? []) as ActivityLogEntry[];
  if (tutorLogs.length === 0) {
    return { ok: true, summary: "No chat activity yet for this course." };
  }

  const samples = tutorLogs
    .slice(0, 40)
    .map((log) => ({
      question: log.request?.message,
      answer: log.response?.answer,
      timestamp: log.timestamp,
    }));

  const prompt = `
You are an instructional analyst. Summarize what students are asking about and the top knowledge gaps.
Provide:
1) 3-5 recurring student questions/topics.
2) The main misconceptions or gaps.
3) Suggested next lessons or interventions.
Keep it concise and actionable.
  `.trim();

  const completion = await client.chat.completions.create({
    model: openaiModel,
    messages: [
      { role: "system", content: prompt },
      { role: "user", content: JSON.stringify(samples) },
    ],
  });

  return {
    ok: true,
    summary: completion.choices[0]?.message?.content?.trim() || "No summary returned.",
  };
}
