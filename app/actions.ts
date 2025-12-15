'use server'

import OpenAI from 'openai';
import { Course, QuizQuestion } from './types';

// Initialize OpenAI / LiteLLM
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: "https://proxy-ai-anes-uabmc-awefchfueccrddhf.eastus2-01.azurewebsites.net/" 
});

// Update function signature to accept userContext
export async function generateCourse(userTopic: string, userContext: string = ""): Promise<Course> {
  if (!userTopic) throw new Error("Topic is required");

  // Incorporate the "About Me" context into the system prompt
  const systemPrompt = `
    You are an expert educational architect.
    
    USER CONTEXT: The user has described themselves as: "${userContext}". 
    ADAPTATION INSTRUCTION: Adjust the tone, complexity, and analogies of the course to fit this user's background.

    Goal: Generate a structured, multi-modal course.
    
    Adhere to this JSON schema:
    {
      "course_id": "uuid",
      "title": "String",
      "style": "String (e.g., 'Professional', 'Simple', 'Academic')",
      "chapters": [
        {
          "id": 1,
          "title": "String",
          "summary": "String",
          "content_markdown": "String (300 words, rich text)",
          "audio_script": "String (Conversational script)",
          "quiz": [
             // Generate exactly 5 questions
            { "question": "String", "options": ["A", "B", "C", "D"], "correct_answer": 0 }
          ]
        }
      ]
    }

    DESIGN RULES:
    1. Structure: Exactly 3 chapters.
    2. Quiz: Exactly 5 questions per chapter.
    3. Output: ONLY raw JSON.
  `;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-nano", 
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Create a course on: "${userTopic}"` },
      ],
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0].message.content;
    if (!content) throw new Error("No content generated");

    return JSON.parse(content) as Course;

  } catch (error) {
    console.error("Course generation failed:", error);
    throw new Error("Failed to generate course.");
  }
}

interface RemediationRequest {
  courseTitle: string;
  chapterTitle: string;
  chapterContent: string;
  missedQuestions: QuizQuestion[];
  userContext?: string;
}

export async function generateRemediation(request: RemediationRequest): Promise<{ explanation_markdown: string; quiz: QuizQuestion[] }> {
  const { courseTitle, chapterTitle, chapterContent, missedQuestions, userContext = "" } = request;

  const missedList = missedQuestions.map((q, idx) => {
    const correctOption = q.options[q.correct_answer] ?? "";
    return `${idx + 1}. Q: ${q.question}\nCorrect answer: ${correctOption}`;
  }).join('\n');

  const systemPrompt = `
    You are a remediation tutor. Provide targeted help ONLY for the missed questions.
    User context: "${userContext}"
    Course: "${courseTitle}"
    Chapter: "${chapterTitle}"
    Chapter content (for reference): """${chapterContent.slice(0, 6000)}"""

    Return JSON with:
    {
      "explanation_markdown": "Concise markdown explaining the missed concepts; under 200 words; use bullet points if helpful.",
      "quiz": [
        // 3-4 questions focusing ONLY on the missed concepts; keep format same as original quiz schema
        { "question": "String", "options": ["A", "B", "C", "D"], "correct_answer": 0 }
      ]
    }
  `;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-nano",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Missed questions:\n${missedList}` },
      ],
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0].message.content;
    if (!content) throw new Error("No remediation generated");

    return JSON.parse(content) as { explanation_markdown: string; quiz: QuizQuestion[] };
  } catch (error) {
    console.error("Remediation generation failed:", error);
    throw new Error("Failed to generate remediation.");
  }
}

interface QuestionInsightRequest {
  courseTitle: string;
  chapterTitle: string;
  question: QuizQuestion;
  userContext?: string;
}

export async function generateQuestionInsight(request: QuestionInsightRequest): Promise<{ explanation_markdown: string }> {
  const { courseTitle, chapterTitle, question, userContext = "" } = request;

  const correctOption = question.options[question.correct_answer] ?? "";
  const systemPrompt = `
    You are a concise tutor. Explain the concept behind the question and why the correct answer is right.
    Keep it under 120 words. Use markdown. Avoid restating the full question verbatim; focus on teaching.
    User context: "${userContext}"
    Course: "${courseTitle}"
    Chapter: "${chapterTitle}"
  `;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-nano",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Question: ${question.question}\nOptions: ${question.options.join(' | ')}\nCorrect answer: ${correctOption}` },
      ],
    });
    const content = completion.choices[0].message.content;
    if (!content) throw new Error("No explanation generated");
    try {
      return JSON.parse(content) as { explanation_markdown: string };
    } catch {
      return { explanation_markdown: content };
    }
  } catch (error) {
    console.error("Question insight generation failed:", error);
    throw new Error("Failed to generate question insight.");
  }
}
