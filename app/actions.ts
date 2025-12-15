'use server'

import OpenAI from 'openai';
import { Course } from './types';

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