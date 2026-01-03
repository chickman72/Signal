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

export interface Flashcard {
  id?: string | number;
  front: string;
  back: string;
  hint?: string;
}

export interface Chapter {
  id: number;
  title: string;
  summary: string;
  content_markdown: string;
  audio_script: string;
  quiz: QuizQuestion[];
  flashcards?: Flashcard[];
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
   // Persisted quiz answers per chapter
  quizHistory?: Record<number, QuizAnswer[]>;
}

export interface User {
  username: string;
  aboutMe?: string; // <--- NEW FIELD
}

export type AppState = 'AUTH' | 'IDLE' | 'GENERATING' | 'PLAYING';

// Activity logging types for Cosmos
export type ActivityEventType =
  | 'login'
  | 'signup'
  | 'logout'
  | 'profile_update'
  | 'search'
  | 'generate_course'
  | 'verification'
  | 'refinement'
  | 'quiz_submit'
  | 'remediation_request'
  | 'question_insight'
  | 'error';

export interface ActivityLogEntry {
  id: string;
  user?: string;
  eventType: ActivityEventType;
  request?: Record<string, any>;
  response?: Record<string, any>;
  timestamp: string;
  sessionId?: string;
  courseId?: string;
  chapterId?: number;
  latencyMs?: number;
  quizEntries?: number;
  success?: boolean;
  clientMeta?: Record<string, any>;
}
