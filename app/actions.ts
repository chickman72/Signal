'use server'

import OpenAI from 'openai';
import { Course, QuizQuestion, VerificationResult } from './types';

// Initialize OpenAI / LiteLLM
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: "https://proxy-ai-anes-uabmc-awefchfueccrddhf.eastus2-01.azurewebsites.net/" 
});

async function verifyCourseContent(course: Course): Promise<VerificationResult> {
  const chapterDigest = course.chapters.map(ch => {
    const truncatedContent = ch.content_markdown.slice(0, 1200);
    return `- ${ch.title}: ${ch.summary}\nKey claims: ${truncatedContent}`;
  }).join('\n\n');

  const systemPrompt = `
    You are a Senior Medical Safety Officer reviewing educational material for hallucinations, unsafe advice, or unsupported medical claims.
    Evaluate accuracy, clinical safety, and clarity. If anything is questionable or missing evidence, err on caution.
    Respond ONLY with strict JSON matching:
    {
      "status": "VERIFIED" | "CAUTION" | "FLAGGED",
      "score": number, // 0-100 confidence in safety/accuracy
      "notes": "concise rationale; cite risks or confidence drivers"
    }
    Do not include any extra keys, explanations, or prose outside the JSON object.
  `;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-nano",
      messages: [
        { role: "system", content: systemPrompt },
        { 
          role: "user", 
          content: `Course Title: ${course.title}\nStyle: ${course.style}\nChapters:\n${chapterDigest}`
        },
      ],
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0].message.content;
    if (!content) throw new Error("No verification result returned");

    const parsed = JSON.parse(content) as VerificationResult;
    return parsed;
  } catch (error) {
    console.error("Course verification failed:", error);
    return {
      status: 'CAUTION',
      score: 0,
      notes: 'Verification unavailable. Please review manually.'
    };
  }
}

async function refineCourseContent(course: Course, feedback: VerificationResult): Promise<Course> {
  const systemPrompt = `
    You are an Expert Medical Editor. The content below was flagged.
    FEEDBACK: ${feedback.notes}
    INSTRUCTION: Rewrite the flagged sections to address issues while maintaining JSON structure.
    Respond ONLY with the full course JSON, preserving schema and field names.
  `;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-nano",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Original course JSON:\n${JSON.stringify(course)}` },
      ],
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0].message.content;
    if (!content) throw new Error("No refinement result returned");

    return JSON.parse(content) as Course;
  } catch (error) {
    console.error("Course refinement failed:", error);
    return course;
  }
}

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

    const course = JSON.parse(content) as Course;
    const initialResult = await verifyCourseContent(course);

    if (initialResult.score < 90) {
      const refinedCourse = await refineCourseContent(course, initialResult);
      const finalResult = await verifyCourseContent(refinedCourse);

      return { 
        ...refinedCourse, 
        verification: finalResult, 
        originalVerification: initialResult,
        wasRefined: true 
      };
    }

    return { 
      ...course, 
      verification: initialResult, 
      originalVerification: initialResult,
      wasRefined: false 
    };

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
