// app/types.ts

export interface QuizQuestion {
  question: string;
  options: string[];
  correct_answer: number;
}

export interface QuizAnswer {
  question: QuizQuestion;
  selectedOption: number | null;
  isCorrect: boolean;
}

export interface Chapter {
  id: number;
  title: string;
  summary: string;
  content_markdown: string;
  audio_script: string;
  quiz: QuizQuestion[];
}

export interface VerificationResult {
  status: 'VERIFIED' | 'CAUTION' | 'FLAGGED';
  score: number;
  notes: string;
}

// NEW: Track the user's progress for a specific saved course
export interface CourseProgress {
  totalChapters: number;
  completedChapterIds: number[];
  quizScores: Record<number, number>; // chapterId -> score
  overallGrade: number; // 0-100
  percentComplete: number; // 0-100
}

export interface Course {
  course_id: string;
  title: string;
  style: string;
  chapters: Chapter[];
  // Merge progress directly into the course object for easier UI handling
  progress?: CourseProgress; 
  createdAt?: string;
  verification?: VerificationResult;
  originalVerification?: VerificationResult;
  wasRefined?: boolean;
}

export interface User {
  username: string;
  aboutMe?: string; // <--- NEW FIELD
}

export type AppState = 'AUTH' | 'IDLE' | 'GENERATING' | 'PLAYING';
