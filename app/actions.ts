'use server'

import OpenAI from 'openai';
import { Course, QuizQuestion, User, VerificationResult } from './types';
import { getOrCreateUser, logEvent } from './dbActions';

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
    const completion = await getOpenAIClient().chat.completions.create({
      model: requireOpenAIModel(),
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
    const completion = await getOpenAIClient().chat.completions.create({
      model: requireOpenAIModel(),
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

async function generateInitialDraft(systemPrompt: string, userTopic: string) {
  const completion = await getOpenAIClient().chat.completions.create({
    model: requireOpenAIModel(),
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Create a course on: "${userTopic}"` },
    ],
    response_format: { type: "json_object" },
  });

  const content = completion.choices[0].message.content;
  if (!content) throw new Error("No content generated");
  return content;
}

async function evaluateTrustSignal(draftText: string) {
  const completion = await getOpenAIClient().chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "You are an academic compliance evaluator. Review the following educational text. Does it include specific references to empirical evidence, peer-reviewed studies, or established academic frameworks to support its claims? \n- If YES, respond ONLY with 'PASS'. \n- If NO, respond with 'FAIL: [Explain exactly which claims need evidence or framing adjustments to be academically safe].'",
      },
      { role: "user", content: draftText },
    ],
  });

  return completion.choices[0].message.content?.trim() ?? "FAIL: No evaluator response.";
}

async function reviseDraft(draftText: string, critique: string) {
  const completion = await getOpenAIClient().chat.completions.create({
    model: requireOpenAIModel(),
    messages: [
      {
        role: "system",
        content: `You are an academic editor. Rewrite the following text to resolve this critique: ${critique}. You MUST add realistic, established academic references, theories, or explicitly frame the concepts as 'theoretical best practices' rather than unproven scientific facts. Maintain the original formatting. Return ONLY the complete revised JSON object, preserving the original schema and field names.`,
      },
      { role: "user", content: draftText },
    ],
    response_format: { type: "json_object" },
  });

  const content = completion.choices[0].message.content;
  if (!content) throw new Error("No revised draft returned");
  return content;
}

function inferDomainFromText(value?: string) {
  const text = value?.trim();
  if (!text) return "";

  const explicitMatch = text.match(
    /\b(?:field of study|field|domain|profession|role|work(?:ing)? in|student in|studying)\s*(?:is|:|=|as)?\s*([^.;,\n]+)/i,
  );
  if (explicitMatch?.[1]) return explicitMatch[1].trim();

  return text.length <= 80 ? text : "";
}

async function resolveUserDomain(username: string | undefined, userContext: string) {
  let profile: User | null = null;

  if (username) {
    try {
      profile = await getOrCreateUser(username);
    } catch {
      profile = null;
    }
  }

  return (
    profile?.fieldOfStudy?.trim() ||
    profile?.profession?.trim() ||
    profile?.domain?.trim() ||
    inferDomainFromText(profile?.aboutMe) ||
    inferDomainFromText(userContext) ||
    "General Subject Matter"
  );
}

export async function generateCourse(userTopic: string, userContext: string = "", username?: string): Promise<Course> {
  if (!userTopic) throw new Error("Topic is required");

  const userDomain = await resolveUserDomain(username, userContext);

  const systemPrompt = `
    You are an expert instructor in ${userDomain}. Your goal is to create high-yield, bite-sized study materials for students in this field.

    USER CONTEXT: The user has described themselves as: "${userContext || "No additional profile context provided"}".
    COURSE TOPIC: "${userTopic}"

    MICROlearning RULES:
    - You MUST NOT write any paragraph longer than 3 sentences. Be punchy and concise.
    - Do not use generic AI filler phrases such as "In conclusion," "It is important to note," or "Delving into."
    - Each chapter must be high-yield and bite-sized, optimized for quick study sessions.

    MANDATORY MARKDOWN STRUCTURE:
    Every concept explained inside content_markdown MUST follow this exact Markdown structure:

    ### Concept Name
    **The Bottom Line:** A strict one-sentence definition of the concept.

    **The Mechanics / The Why:**
    - A brief bullet explaining the underlying mechanism, theory, or process.
    - A brief bullet explaining the underlying mechanism, theory, or process.
    - A brief bullet explaining the underlying mechanism, theory, or process.

    **Real-World Scenario:** A realistic, practical application of this concept specific to ${userDomain}. If the domain is Nursing, use a clinical patient scenario. If the domain is Business, use a corporate case study. If the domain is Computer Science, use a software architecture problem.

    Adhere to this JSON schema exactly:
    {
      "course_id": "uuid",
      "title": "String",
      "domain": "${userDomain}",
      "style": "String (e.g., 'Professional', 'Simple', 'Academic')",
      "chapters": [
        {
          "id": 1,
          "title": "String",
          "summary": "String",
          "content_markdown": "String using the mandatory Markdown structure for every concept",
          "audio_script": "String (brief conversational script, no paragraph longer than 3 sentences)",
          "quiz": [
             // Generate exactly 5 questions
            { "question": "String", "options": ["A", "B", "C", "D"], "correct_answer": 0 }
          ]
        }
      ]
    }

    DESIGN RULES:
    1. Structure: Exactly 5 chapters.
    2. Quiz: Exactly 5 questions per chapter.
    3. content_markdown must contain 2-3 concepts per chapter.
    4. The Real-World Scenario in each concept must be specific to ${userDomain}.
    5. Output: ONLY raw JSON.
  `;

  try {
    const started = Date.now();
    await logEvent('generate_course', {
      user: username,
      request: { topic: userTopic, userContext, userDomain }
    });

    let draftText = await generateInitialDraft(systemPrompt, userTopic);
    let trustSignalReview = "";
    let revisedForEvidence = false;

    for (let iteration = 0; iteration < 2; iteration++) {
      trustSignalReview = await evaluateTrustSignal(draftText);
      if (trustSignalReview.toUpperCase().startsWith("PASS")) break;

      draftText = await reviseDraft(draftText, trustSignalReview);
      revisedForEvidence = true;
    }

    const course = JSON.parse(draftText) as Course;
    const initialResult = await verifyCourseContent(course);

    if (initialResult.score < 90) {
      const refinedCourse = await refineCourseContent(course, initialResult);
      const finalResult = await verifyCourseContent(refinedCourse);

      await logEvent('refinement', {
        user: username,
        courseId: refinedCourse.course_id,
        latencyMs: Date.now() - started,
        request: { topic: userTopic, trustSignalReview },
        response: { verification: finalResult, originalVerification: initialResult, revisedForEvidence }
      });

      return { 
        ...refinedCourse, 
        verification: finalResult, 
        originalVerification: initialResult,
        wasRefined: true 
      };
    }

    await logEvent('verification', {
      user: username,
      courseId: course.course_id,
      latencyMs: Date.now() - started,
      response: { verification: initialResult, trustSignalReview, revisedForEvidence }
    });

    return { 
      ...course, 
      verification: initialResult, 
      originalVerification: initialResult,
      wasRefined: false 
    };

  } catch (error) {
    await logEvent('error', {
      user: username,
      request: { topic: userTopic },
      success: false,
      response: { message: 'Course generation failed', error: String(error) }
    });
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
  username?: string;
}

export async function generateRemediation(request: RemediationRequest): Promise<{ explanation_markdown: string; quiz: QuizQuestion[] }> {
  const { courseTitle, chapterTitle, chapterContent, missedQuestions, userContext = "", username } = request;

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
    const started = Date.now();
    await logEvent('remediation_request', {
      user: username,
      courseId: undefined,
      chapterId: undefined,
      request: {
        courseTitle,
        chapterTitle,
        missed: missedQuestions.length
      }
    });

    const completion = await getOpenAIClient().chat.completions.create({
      model: requireOpenAIModel(),
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Missed questions:\n${missedList}` },
      ],
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0].message.content;
    if (!content) throw new Error("No remediation generated");

    const parsed = JSON.parse(content) as { explanation_markdown: string; quiz: QuizQuestion[] };

    await logEvent('remediation_request', {
      user: username,
      latencyMs: Date.now() - started,
      request: {
        courseTitle,
        chapterTitle,
        missed: missedQuestions.length
      },
      response: { generatedQuiz: parsed.quiz?.length ?? 0 }
    });

    return parsed;
  } catch (error) {
    await logEvent('error', {
      user: username,
      success: false,
      request: { courseTitle, chapterTitle, missed: missedQuestions.length },
      response: { message: 'Failed to generate remediation', error: String(error) }
    });
    console.error("Remediation generation failed:", error);
    throw new Error("Failed to generate remediation.");
  }
}

interface QuestionInsightRequest {
  courseTitle: string;
  chapterTitle: string;
  question: QuizQuestion;
  userContext?: string;
  username?: string;
}

export async function generateQuestionInsight(request: QuestionInsightRequest): Promise<{ explanation_markdown: string }> {
  const { courseTitle, chapterTitle, question, userContext = "", username } = request;

  const correctOption = question.options[question.correct_answer] ?? "";
  const systemPrompt = `
    You are a concise tutor. Explain the concept behind the question and why the correct answer is right.
    Keep it under 120 words. Use markdown. Avoid restating the full question verbatim; focus on teaching.
    User context: "${userContext}"
    Course: "${courseTitle}"
    Chapter: "${chapterTitle}"
  `;

  try {
    const started = Date.now();
    await logEvent('question_insight', {
      user: username,
      request: { courseTitle, chapterTitle, question: question.question }
    });

    const completion = await getOpenAIClient().chat.completions.create({
      model: requireOpenAIModel(),
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Question: ${question.question}\nOptions: ${question.options.join(' | ')}\nCorrect answer: ${correctOption}` },
      ],
    });
    const content = completion.choices[0].message.content;
    if (!content) throw new Error("No explanation generated");
    try {
      const parsed = JSON.parse(content) as { explanation_markdown: string };
      await logEvent('question_insight', {
        user: username,
        latencyMs: Date.now() - started,
        request: { courseTitle, chapterTitle, question: question.question },
        response: { success: true }
      });
      return parsed;
    } catch {
      await logEvent('question_insight', {
        user: username,
        latencyMs: Date.now() - started,
        request: { courseTitle, chapterTitle, question: question.question },
        response: { success: true, parsedAs: 'string' }
      });
      return { explanation_markdown: content };
    }
  } catch (error) {
    await logEvent('error', {
      user: username,
      success: false,
      request: { courseTitle, chapterTitle, question: question.question },
      response: { message: 'Failed to generate question insight', error: String(error) }
    });
    console.error("Question insight generation failed:", error);
    throw new Error("Failed to generate question insight.");
  }
}
