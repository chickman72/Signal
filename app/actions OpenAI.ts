'use server'

import OpenAI from 'openai';
import { Course } from './types';

// Initialize OpenAI (ensure OPENAI_API_KEY is in your .env)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function generateCourse(userTopic: string): Promise<Course> {
  if (!userTopic) throw new Error("Topic is required");

  const systemPrompt = `
    You are an expert educational architect for an adaptive learning platform. 
    Your goal is to generate a structured, multi-modal course based on a user's topic.
    
    Adhere to this specific JSON schema strictly:
    {
      "course_id": "uuid",
      "title": "String",
      "style": "String (e.g., 'Podcast', 'University Lecture', 'Witty')",
      "chapters": [
        {
          "id": 1,
          "title": "String",
          "summary": "String (1-2 sentences)",
          "content_markdown": "String (300 words, rich text)",
          "audio_script": "String (Conversational, podcast-style script, distinct from content)",
          "quiz": [
            { "question": "String", "options": ["A", "B", "C", "D"], "correct_answer": 0 } 
          ],
          "flashcards": [ { "front": "String", "back": "String" } ]
        }
      ]
    }

    DESIGN RULES:
    1. **Chain of Thought:** Analyze the intent. If the topic is "Quantum Physics for 5-year-olds", the tone must be playful and simple. If "Advanced Macroeconomics", be academic.
    2. **Structure:** Generate exactly 3 chapters.
    3. **Audio Script:** This is CRITICAL. Write the script as if a host is speaking to the user. Do not read the markdown verbatim. Summarize and engage.
    4. **Output:** Return ONLY raw JSON. No markdown code blocks.
  `;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Create a course on: "${userTopic}"` },
      ],
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0].message.content;
    if (!content) throw new Error("No content generated");

    const courseData = JSON.parse(content) as Course;
    return courseData;

  } catch (error) {
    console.error("Course generation failed:", error);
    throw new Error("Failed to generate course. Please try again.");
  }
}