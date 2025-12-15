// app/types.ts
export interface QuizQuestion {
  question: string;
  options: string[];
  correct_answer: number;
}

export interface Flashcard {
  front: string;
  back: string;
}

export interface Chapter {
  id: number;
  title: string;
  summary: string;
  content_markdown: string;
  audio_script: string;
  quiz: QuizQuestion[];
  flashcards: Flashcard[];
}

export interface Course {
  course_id: string;
  title: string;
  style: string;
  chapters: Chapter[];
}

export type AppState = 'IDLE' | 'GENERATING' | 'PLAYING';