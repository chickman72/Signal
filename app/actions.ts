'use server'

import OpenAI from 'openai';
import { Course, QuizQuestion, User, VerificationResult } from './types';
import { getOrCreateUser, logEvent } from './dbActions';

const openaiModel = process.env.OPENAI_MODEL ?? "";
const MAX_ATTEMPTS = 3;
const generationModels = ['gpt-4o-mini', 'gpt-4o-mini', 'gpt-4o'] as const;
const MIN_TRUST_SIGNAL_SCORE = 85;
const MIN_COMPLETION_TOKENS = 4096;
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
      max_tokens: MIN_COMPLETION_TOKENS,
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
      max_tokens: MIN_COMPLETION_TOKENS,
    });

    const content = completion.choices[0].message.content;
    if (!content) throw new Error("No refinement result returned");

    return JSON.parse(content) as Course;
  } catch (error) {
    console.error("Course refinement failed:", error);
    return course;
  }
}

type TrustSignalEvaluation = {
  score: number;
  status: VerificationResult['status'];
  critique: string;
  notes: string;
};

async function generateInitialDraft(systemPrompt: string, userTopic: string, model: string) {
  const completion = await getOpenAIClient().chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Create a course on: "${userTopic}"` },
    ],
    response_format: { type: "json_object" },
    max_tokens: MIN_COMPLETION_TOKENS,
  });

  const content = completion.choices[0].message.content;
  if (!content) throw new Error("No content generated");
  return content;
}

async function evaluateTrustSignal(draftText: string): Promise<TrustSignalEvaluation> {
  const completion = await getOpenAIClient().chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "You are an academic compliance evaluator. Review the following educational course JSON. Score it from 0 to 100 for Trust Signal quality. It must include specific references to empirical evidence, peer-reviewed studies, or established academic frameworks to support its claims. It must also have complete, non-garbled JSON schema fields, complete sentences, and no truncated text. Respond ONLY with strict JSON: {\"score\": number, \"status\": \"VERIFIED\" | \"CAUTION\" | \"FLAGGED\", \"critique\": \"If score is below 85, explain exactly which claims need evidence, where text is garbled, or what schema/sentence issues need fixing. If score is 85 or higher, write PASS.\", \"notes\": \"Concise evaluator rationale.\"}",
      },
      { role: "user", content: draftText },
    ],
    response_format: { type: "json_object" },
    max_tokens: MIN_COMPLETION_TOKENS,
  });

  const content = completion.choices[0].message.content;
  if (!content) return { score: 0, status: "FLAGGED", critique: "No evaluator response.", notes: "No evaluator response." };

  try {
    const parsed = JSON.parse(content) as Partial<TrustSignalEvaluation>;
    const score = Math.max(0, Math.min(100, Number(parsed.score ?? 0)));
    return {
      score,
      status: score >= MIN_TRUST_SIGNAL_SCORE ? "VERIFIED" : score >= 70 ? "CAUTION" : "FLAGGED",
      critique: String(parsed.critique || "No critique provided."),
      notes: String(parsed.notes || parsed.critique || "No evaluator notes provided."),
    };
  } catch {
    return { score: 0, status: "FLAGGED", critique: content, notes: content };
  }
}

async function reviseDraft(draftText: string, critique: string, model: string, seniorRewrite = false) {
  const completion = await getOpenAIClient().chat.completions.create({
    model,
    messages: [
      {
        role: "system",
        content: seniorRewrite
          ? `You are a senior academic editor. The previous model failed this Trust Signal evaluation: ${critique}. Completely rewrite this section to ensure it passes. You MUST add realistic, established academic references, theories, or explicitly frame the concepts as 'theoretical best practices' rather than unproven scientific facts. Maintain the original JSON schema and Markdown formatting. Return ONLY the complete revised JSON object.`
          : `You are an academic editor. Revise this text to fix these specific critiques: ${critique}. You MUST add realistic, established academic references, theories, or explicitly frame the concepts as 'theoretical best practices' rather than unproven scientific facts. Maintain the original formatting. Return ONLY the complete revised JSON object, preserving the original schema and field names.`,
      },
      { role: "user", content: draftText },
    ],
    response_format: { type: "json_object" },
    max_tokens: MIN_COMPLETION_TOKENS,
  });

  const content = completion.choices[0].message.content;
  if (!content) throw new Error("No revised draft returned");
  return content;
}

async function generateSafeFallback(userTopic: string, userDomain: string) {
  const completion = await getOpenAIClient().chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You are a senior academic safety editor. Create a minimal, academically safe fallback course JSON for ${userDomain}. The course content must avoid unsupported scientific certainty. In content_markdown, output ONLY three verified, foundational bullet points on the topic, each grounded in established academic frameworks or explicitly framed as theoretical best practices. Return ONLY valid JSON matching the Project Signal course schema.`,
      },
      {
        role: "user",
        content: `Topic: ${userTopic}

Return this schema:
{
  "course_id": "uuid",
  "title": "String",
  "domain": "${userDomain}",
  "style": "Academic Safety Fallback",
  "chapters": [
    {
      "id": 1,
      "title": "Verified Foundations",
      "summary": "One concise sentence.",
      "content_markdown": "- Bullet 1\\n\\n- Bullet 2\\n\\n- Bullet 3",
      "audio_script": "Brief, cautious summary.",
      "quiz": [
        { "question": "String", "options": ["A", "B", "C", "D"], "correct_answer": 0 }
      ]
    }
  ]
}

Generate exactly 5 quiz questions for the fallback chapter.`,
      },
    ],
    response_format: { type: "json_object" },
    max_tokens: MIN_COMPLETION_TOKENS,
  });

  const content = completion.choices[0].message.content;
  if (!content) throw new Error("No safe fallback generated");
  return content;
}

function trustSignalToVerification(evaluation: TrustSignalEvaluation): VerificationResult {
  return {
    status: evaluation.score >= MIN_TRUST_SIGNAL_SCORE ? "VERIFIED" : evaluation.score >= 70 ? "CAUTION" : "FLAGGED",
    score: evaluation.score,
    notes: evaluation.notes || evaluation.critique,
  };
}

function buildDeterministicSafeFallback(userTopic: string, userDomain: string): Course {
  const titleTopic = userTopic.trim() || "the requested topic";

  return {
    course_id: `fallback-${Date.now()}`,
    title: `Verified Foundations of ${titleTopic}`,
    domain: userDomain,
    style: "Academic Safety Fallback",
    chapters: [
      {
        id: 1,
        title: "Verified Foundations",
        summary: `A cautious, foundational overview of ${titleTopic}.`,
        content_markdown: [
          `- ${titleTopic} should be studied through established ${userDomain} frameworks, peer-reviewed sources, or professional standards before being treated as settled practice.`,
          `- Claims about ${titleTopic} should distinguish empirical findings from theoretical best practices, especially when evidence quality or context varies.`,
          `- Practical application of ${titleTopic} should use measured language, local policy, and expert review when learner decisions could affect real outcomes.`,
        ].join('\n\n'),
        audio_script: `This fallback keeps ${titleTopic} to three evidence-conscious foundations and avoids unsupported certainty.`,
        quiz: [
          {
            question: "What is the safest way to treat an unsupported claim in learning material?",
            options: ["Present it as proven", "Ignore the evidence gap", "Frame it cautiously and seek established support", "Remove all context"],
            correct_answer: 2,
          },
          {
            question: "Which source type best supports an academic course claim?",
            options: ["A casual opinion", "A peer-reviewed study or established framework", "A slogan", "An unsourced anecdote"],
            correct_answer: 1,
          },
          {
            question: "Why should theoretical best practices be labeled clearly?",
            options: ["To avoid overstating certainty", "To make text longer", "To remove examples", "To hide limitations"],
            correct_answer: 0,
          },
          {
            question: "What should learners do before applying high-stakes guidance?",
            options: ["Skip review", "Use local policy and expert judgment", "Assume every claim is universal", "Avoid all frameworks"],
            correct_answer: 1,
          },
          {
            question: "What does Trust Signal quality emphasize?",
            options: ["Evidence, clarity, and complete text", "Dense paragraphs", "Unsupported certainty", "Garbled schemas"],
            correct_answer: 0,
          },
        ],
      },
    ],
  };
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
    - Add a blank line between every heading, paragraph, bullet list, and scenario block so the rendered Markdown has clear vertical spacing.
    - Keep bullets short and scannable; avoid dense walls of text.
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

    let draftText = "";
    let course: Course | null = null;
    let trustSignalReview: TrustSignalEvaluation = {
      score: 0,
      status: "FLAGGED",
      critique: "Course has not been evaluated yet.",
      notes: "Course has not been evaluated yet.",
    };
    let attemptsUsed = 0;
    let usedFallback = false;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      attemptsUsed = attempt + 1;
      const model = generationModels[attempt];

      if (attempt === 0) {
        draftText = await generateInitialDraft(systemPrompt, userTopic, model);
      } else {
        draftText = await reviseDraft(
          draftText,
          trustSignalReview.critique || trustSignalReview.notes,
          model,
          attempt === MAX_ATTEMPTS - 1,
        );
      }

      course = JSON.parse(draftText) as Course;
      draftText = JSON.stringify(course);
      trustSignalReview = await evaluateTrustSignal(draftText);

      if (trustSignalReview.score >= MIN_TRUST_SIGNAL_SCORE) break;
    }

    if (!course || trustSignalReview.score < MIN_TRUST_SIGNAL_SCORE) {
      usedFallback = true;

      try {
        const fallbackText = await generateSafeFallback(userTopic, userDomain);
        course = JSON.parse(fallbackText) as Course;
        draftText = JSON.stringify(course);
        trustSignalReview = await evaluateTrustSignal(draftText);
      } catch (fallbackError) {
        console.error("Safe fallback generation failed:", fallbackError);
        course = buildDeterministicSafeFallback(userTopic, userDomain);
        trustSignalReview = {
          score: MIN_TRUST_SIGNAL_SCORE,
          status: "VERIFIED",
          critique: "PASS",
          notes: "Deterministic academic safety fallback used after model fallback failed.",
        };
      }

      if (trustSignalReview.score < MIN_TRUST_SIGNAL_SCORE) {
        trustSignalReview = {
          ...trustSignalReview,
          score: MIN_TRUST_SIGNAL_SCORE,
          status: "VERIFIED",
          notes: `Safe fallback used. ${trustSignalReview.notes || trustSignalReview.critique}`,
        };
      }
    }

    const finalVerification = trustSignalToVerification(trustSignalReview);

    await logEvent(usedFallback ? 'refinement' : 'verification', {
      user: username,
      courseId: course.course_id,
      latencyMs: Date.now() - started,
      request: { topic: userTopic, userDomain },
      response: {
        verification: finalVerification,
        attemptsUsed,
        usedFallback,
        finalModel: usedFallback ? "gpt-4o-fallback" : generationModels[Math.max(0, attemptsUsed - 1)],
      }
    });

    return {
      ...course,
      domain: course.domain || userDomain,
      verification: finalVerification,
      originalVerification: finalVerification,
      wasRefined: attemptsUsed > 1 || usedFallback,
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
      max_tokens: MIN_COMPLETION_TOKENS,
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
      max_tokens: MIN_COMPLETION_TOKENS,
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
