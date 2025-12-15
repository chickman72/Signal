import { Course } from './types';

export const MOCK_COURSE: Course = {
  course_id: "demo-123",
  title: "Nursing Informatics 101",
  style: "Professional",
  chapters: [
    {
      id: 1,
      title: "The Data-Information-Knowledge-Wisdom (DIKW) Framework",
      summary: "Understanding the core hierarchy of nursing informatics.",
      content_markdown: "The **DIKW hierarchy** is a model used to discuss the structure and retrieval of information...",
      audio_script: "Imagine you have a patient's vitals. That's data...",
      quiz: [
        {
          question: "Which level of the DIKW hierarchy involves applying knowledge to solve problems?",
          options: ["Data", "Information", "Knowledge", "Wisdom"],
          correct_answer: 3
        },
        {
          question: "A blood pressure reading of 120/80 without context is considered:",
          options: ["Wisdom", "Data", "Information", "Knowledge"],
          correct_answer: 1
        },
        {
          question: "Which term refers to synthesized information identifying patterns?",
          options: ["Data", "Information", "Knowledge", "Wisdom"],
          correct_answer: 2
        },
        {
          question: "In the DIKW framework, 'Wisdom' is best described as:",
          options: ["Raw facts", "Knowing why and how to apply data", "Organized data", "Computer processing"],
          correct_answer: 1
        },
        {
          question: "Electronic Health Records (EHRs) primarily store which levels of DIKW?",
          options: ["Data and Information", "Wisdom only", "Knowledge only", "None of the above"],
          correct_answer: 0
        }
      ],
      flashcards: []
    },
    // Add a second chapter so 'Continue' has somewhere to go!
    {
      id: 2,
      title: "Standardized Terminologies",
      summary: "Why we need a common language in healthcare.",
      content_markdown: "Standardized terminologies (like SNOMED, LOINC) ensure that data can be shared across systems...",
      audio_script: "If I say 'high BP' and you say 'Hypertension', a computer might get confused...",
      quiz: [
        { question: "Q1", options: ["A","B","C","D"], correct_answer: 0 },
        { question: "Q2", options: ["A","B","C","D"], correct_answer: 0 },
        { question: "Q3", options: ["A","B","C","D"], correct_answer: 0 },
        { question: "Q4", options: ["A","B","C","D"], correct_answer: 0 },
        { question: "Q5", options: ["A","B","C","D"], correct_answer: 0 }
      ],
      flashcards: []
    }
  ]
};