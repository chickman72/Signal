"use server";

import OpenAI from "openai";
import { searchClient } from "../lib/search";
import { getChatSessionsContainer } from "../lib/db";
import { logEvent } from "../dbActions";
import { getCourseDetails } from "./courses";
import { createChatSession } from "./chatSessions";

const openaiModel = process.env.OPENAI_MODEL ?? "";
let openaiClient: OpenAI | null = null;

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY.");
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey,
      baseURL: process.env.OPENAI_BASE_URL,
    });
  }
  return openaiClient;
}

function requireOpenAIModel() {
  if (!openaiModel) throw new Error("Missing OPENAI_MODEL.");
  return openaiModel;
}

const GREETING_PROMPT =
  "You are a warm Nursing Preceptor. Introduce yourself briefly and ask the first diagnostic question based on the Course settings.";

const TUTOR_PROMPT =
  "You are a Nursing Preceptor. The session is IN PROGRESS. DO NOT say \"Welcome\" or \"Hello\" again. Respond directly to the student's last input.";

function escapeFilterValue(value: string) {
  return value.replace(/'/g, "''");
}

function buildBasePersonaPrompt() {
  return `
Role: You are a warm, encouraging Nursing Preceptor for first-semester students.

Golden Rule:
- Do NOT ask "What do you want to learn?" or similar.
- If the student mentions a broad topic (e.g., "GU"), immediately choose a specific concept from the Context and ask a conceptual question about it.

The Loop:
1) Conceptual Question: Ask a Remember/Understand level question (e.g., "What is the function of X?").
2) Wait for the student's answer.
3) Scenario Question: Once they show understanding, ask a clinical scenario about the same concept.

Feedback Style:
- If correct: Validate warmly (e.g., "Exactly!"), then move to the next step.
- If incorrect: Be gentle. "Not quite. Think about... [hint]." Do not give the answer immediately; ask a guiding question.

Context Switching:
- CRITICAL RULE: If the user explicitly asks to change topics (e.g., "I want GI", "Stop talking about GU"), you MUST abandon the previous line of questioning immediately. Acknowledge the switch and ask a starter question for the NEW topic.
- ANTI-LOOP RULE: Do not repeat the exact same question twice in a row. If the user is stuck, rephrase the question or ask a simpler prerequisite question.

Context Usage:
- You must base your questions ONLY on the provided Context chunks.
- Do not quiz on topics not found in the documents.
  `.trim();
}

async function buildContextBlock(courseId: string, queryText?: string) {
  let client;
  try {
    client = searchClient();
  } catch (error) {
    console.error("Tutor search client init failed:", error);
    return "No relevant context found.";
  }

  const filter = `courseId eq '${escapeFilterValue(courseId)}'`;
  const contextChunks: string[] = [];

  if (queryText) {
    let embedding: number[] | undefined;
    try {
      const embeddingResponse = await getOpenAIClient().embeddings.create({
        model: "text-embedding-3-small",
        input: queryText,
      });
      embedding = embeddingResponse.data[0]?.embedding;
    } catch (error) {
      console.error("Tutor embedding generation failed:", error);
    }
    if (!embedding) return "No relevant context found.";

    let searchResponse;
    try {
      searchResponse = await client.search("*", {
        filter,
        select: ["content", "sourcefile"],
        vectorSearchOptions: {
          queries: [
            {
              kind: "vector",
              vector: embedding,
              kNearestNeighborsCount: 3,
              fields: ["embedding"],
            },
          ],
        },
      });
    } catch (error) {
      console.error("Tutor vector search failed:", error);
      return "No relevant context found.";
    }

    for await (const result of searchResponse.results) {
      const doc = result.document as { content?: string; sourcefile?: string };
      if (doc.content) {
        const label = doc.sourcefile ? `Source: ${doc.sourcefile}` : "Source: Unknown";
        contextChunks.push(`${label}\n${doc.content}`);
      }
      if (contextChunks.length >= 3) break;
    }
  } else {
    const searchResponse = await client.search("*", {
      filter,
      select: ["content", "sourcefile"],
      top: 3,
    });
    for await (const result of searchResponse.results) {
      const doc = result.document as { content?: string; sourcefile?: string };
      if (doc.content) {
        const label = doc.sourcefile ? `Source: ${doc.sourcefile}` : "Source: Unknown";
        contextChunks.push(`${label}\n${doc.content}`);
      }
    }
  }

  return contextChunks.length
    ? contextChunks.map((chunk, idx) => `--- Context ${idx + 1} ---\n${chunk}`).join("\n\n")
    : "No relevant context found.";
}

async function generateSearchQuery(lastUserMessage: string, chatHistory: string) {
  const prompt = `
Given the user's last message, identify the specific medical topic they want to discuss.
- If they are changing topics (e.g., "Switch to GI"), return a normalized topic label (e.g., "Gastrointestinal Pathophysiology").
- If they are answering a question, return the current topic.
- Return ONLY the topic phrase, no extra text.
  `.trim();

  const completion = await getOpenAIClient().chat.completions.create({
    model: requireOpenAIModel(),
    messages: [
      { role: "system", content: prompt },
      {
        role: "user",
        content: `Last message:\n${lastUserMessage}\n\nChat history:\n${chatHistory}`,
      },
    ],
  });

  return completion.choices[0]?.message?.content?.trim() || lastUserMessage;
}

export async function initializeTutorSession(courseId: string, studentName?: string) {
  try {
    if (!courseId) throw new Error("courseId is required.");

    const session = await createChatSession(courseId, studentName);
    const course = await getCourseDetails(courseId);
    const instructorPrompt = course?.systemPrompt?.trim();
    const contextBlock = await buildContextBlock(courseId);

    const basePersonaPrompt = buildBasePersonaPrompt();
    const finalSystemPrompt = `
${basePersonaPrompt}

Instructor Context:
${instructorPrompt || "No additional instructor guidance provided."}

Knowledge Context (source of truth):
${contextBlock}
  `.trim();

    const completion = await getOpenAIClient().chat.completions.create({
      model: requireOpenAIModel(),
      messages: [
        { role: "system", content: finalSystemPrompt },
        { role: "user", content: GREETING_PROMPT },
      ],
    });

    const responseText = completion.choices[0]?.message?.content?.trim();
    if (!responseText) throw new Error("No response from tutor.");

    const container = await getChatSessionsContainer();
    const now = new Date().toISOString();
    const updatedSession = {
      ...session,
      messages: [{ role: "assistant", content: responseText, createdAt: now }],
      lastUpdated: now,
    };

    await container.item(session.id, session.id).replace(updatedSession);

    return {
      ok: true as const,
      sessionId: session.id,
      initialMessage: responseText,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start tutor session.";
    console.error("Tutor session init failed:", error);
    return { ok: false as const, error: message };
  }
}

export async function chatWithTutor(
  sessionId: string,
  userMessage: string,
  courseId: string,
) {
  try {
    if (!sessionId || !userMessage || !courseId) {
      throw new Error("sessionId, userMessage, and courseId are required.");
    }

    const container = await getChatSessionsContainer();
    const { resource } = await container.item(sessionId, sessionId).read();
    if (!resource) {
      throw new Error("Chat session not found.");
    }

    const historyMessages = Array.isArray(resource.messages) ? resource.messages : [];
    const recentHistory = historyMessages
      .slice(-8)
      .map((message: { role?: string; content?: string }) => {
        const role = message.role === "assistant" ? "Tutor" : "Student";
        return `${role}: ${message.content ?? ""}`;
      })
      .join("\n");

    const searchQuery = await generateSearchQuery(userMessage, recentHistory);
    const contextBlock = await buildContextBlock(courseId, searchQuery);
    const basePersonaPrompt = buildBasePersonaPrompt();
    const course = await getCourseDetails(courseId);
    const instructorPrompt = course?.systemPrompt?.trim();
    const finalSystemPrompt = `
${basePersonaPrompt}

Instructor Context:
${instructorPrompt || "No additional instructor guidance provided."}

Knowledge Context (source of truth):
${contextBlock}

Session Guidance:
${TUTOR_PROMPT}

Evaluation Rules:
- If the user gives a simple or wrong answer, do NOT repeat your previous question verbatim. Acknowledge their input and ask a new guiding question.
- ANTI-REPETITION: Compare your new question to the Chat History. If it is identical to the last message, change the wording immediately.
Chat History (most recent first):
${recentHistory}
  `.trim();

    const completion = await getOpenAIClient().chat.completions.create({
      model: requireOpenAIModel(),
      messages: [
        { role: "system", content: finalSystemPrompt },
        { role: "user", content: userMessage },
      ],
    });

    const responseText = completion.choices[0]?.message?.content?.trim();
    if (!responseText) throw new Error("No response from tutor.");

    const messages = Array.isArray(resource.messages) ? resource.messages : [];
    const now = new Date().toISOString();
    messages.push({ role: "user", content: userMessage, createdAt: now });
    messages.push({ role: "assistant", content: responseText, createdAt: now });

    const updatedSession = {
      ...resource,
      messages,
      lastUpdated: now,
    };

    await container.item(sessionId, sessionId).replace(updatedSession);

    await logEvent("tutor_chat", {
      user: sessionId,
      courseId,
      sessionId,
      request: { message: userMessage },
      response: { answer: responseText },
    });

    return { ok: true as const, message: responseText };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Tutor response failed.";
    console.error("Tutor chat failed:", error);
    return { ok: false as const, error: message };
  }
}
