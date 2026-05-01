'use client'

import React, { useEffect, useState } from 'react';
import { CheckCircle, XCircle, ArrowRight, RefreshCw } from 'lucide-react';
import { QuizQuestion, QuizAnswer } from './types';
import { motion, AnimatePresence } from 'framer-motion';

interface QuizPlayerProps {
  questions: QuizQuestion[];
  onComplete: (result: { score: number; wrongQuestions: QuizQuestion[]; answers: QuizAnswer[] }) => void;
}

export default function QuizPlayer({ questions, onComplete }: QuizPlayerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [showSummary, setShowSummary] = useState(false);
  const [answers, setAnswers] = useState<(boolean | null)[]>(() => Array(questions.length).fill(null));
  const [selectedOptions, setSelectedOptions] = useState<(number | null)[]>(() => Array(questions.length).fill(null));

  const currentQuestion = questions[currentIndex];

  const handleCheck = () => {
    if (selectedOption === null) return;
    setIsAnswered(true);
    const isCorrect = selectedOption === currentQuestion.correct_answer;
    setAnswers(prev => {
      const next = [...prev];
      next[currentIndex] = isCorrect;
      return next;
    });
    setSelectedOptions(prev => {
      const next = [...prev];
      next[currentIndex] = selectedOption;
      return next;
    });
    if (selectedOption === currentQuestion.correct_answer) {
      setScore(s => s + 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setSelectedOption(null);
      setIsAnswered(false);
    } else {
      setShowSummary(true);
    }
  };

  const resetQuiz = () => {
    setCurrentIndex(0);
    setSelectedOption(null);
    setIsAnswered(false);
    setScore(0);
    setShowSummary(false);
    setAnswers(Array(questions.length).fill(null));
    setSelectedOptions(Array(questions.length).fill(null));
  };

  // Reset state when the question set changes (e.g., remediation quiz)
  useEffect(() => {
    resetQuiz();
  }, [questions]);

  // --- SUMMARY VIEW ---
  if (showSummary) {
    const passed = score >= Math.ceil(questions.length / 2);
    const wrongQuestions = questions.filter((_, idx) => answers[idx] !== true);
    const answerPayload: QuizAnswer[] = questions.map((q, idx) => ({
      question: q,
      selectedOption: selectedOptions[idx],
      isCorrect: answers[idx] === true
    }));
    return (
      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 text-center sm:p-8">
        <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto ${passed ? 'bg-emerald-500/20 text-emerald-700' : 'bg-red-500/20 text-red-700'}`}>
          {passed ? <CheckCircle className="w-8 h-8" /> : <XCircle className="w-8 h-8" />}
        </div>
        <h3 className="text-2xl font-bold">{passed ? 'Chapter Complete!' : 'Needs Review'}</h3>
        <p className="text-slate-600">You scored {score} out of {questions.length}</p>
        
        <div className="flex flex-col justify-center gap-3 pt-4 sm:flex-row">
          <button onClick={resetQuiz} className="flex items-center justify-center gap-2 rounded-full bg-slate-200 px-4 py-2 text-sm transition hover:bg-slate-300">
            <RefreshCw className="w-4 h-4" /> Retry
          </button>
          
          {/* FIX: Ensure this calls onComplete with the score */}
          <button 
            onClick={() => onComplete({ score, wrongQuestions, answers: answerPayload })} 
            className="px-4 py-2 rounded-full bg-emerald-600 hover:bg-emerald-500 transition text-white text-sm font-semibold"
          >
            Continue Course
          </button>
        </div>
      </div>
    );
  }

  // ... (Keep the rest of the Question View return statement exactly as it was) ...
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
       <div className="mb-4 flex flex-wrap justify-between gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
        <span>Question {currentIndex + 1} of {questions.length}</span>
        <span>Score: {score}</span>
      </div>
      
      <AnimatePresence mode="wait">
        <motion.div 
          key={currentIndex}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="space-y-6"
        >
          <h4 className="text-base font-medium text-slate-950 sm:text-lg">{currentQuestion.question}</h4>

          <div className="space-y-3">
            {currentQuestion.options.map((option, idx) => {
              const isSelected = selectedOption === idx;
              const isCorrect = idx === currentQuestion.correct_answer;
              let style = "border-slate-300 hover:bg-slate-100";
              if (isSelected) style = "border-indigo-500 bg-indigo-500/20 text-indigo-800";
              if (isAnswered) {
                 if (isCorrect) style = "border-emerald-500 bg-emerald-500/20 text-emerald-700";
                 else if (isSelected && !isCorrect) style = "border-red-500 bg-red-500/20 text-red-700";
                 else style = "border-slate-300 opacity-50";
              }
              return (
                <button
                  key={idx}
                  onClick={() => !isAnswered && setSelectedOption(idx)}
                  disabled={isAnswered}
                  className={`w-full rounded-lg border-2 p-3 text-left text-sm transition-all duration-200 sm:p-4 sm:text-base ${style}`}
                >
                  <div className="flex items-center justify-between">
                    <span>{option}</span>
                    {isAnswered && isCorrect && <CheckCircle className="w-5 h-5 text-emerald-700" />}
                    {isAnswered && isSelected && !isCorrect && <XCircle className="w-5 h-5 text-red-700" />}
                  </div>
                </button>
              );
            })}
          </div>
        </motion.div>
      </AnimatePresence>

      <div className="mt-8 flex justify-stretch sm:justify-end">
        {!isAnswered ? (
          <button 
            onClick={handleCheck}
            disabled={selectedOption === null}
            className="w-full rounded-full bg-slate-900 px-6 py-2 font-bold text-white transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            Check Answer
          </button>
        ) : (
          <button 
            onClick={handleNext}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-emerald-600 px-6 py-2 font-bold text-white transition hover:bg-emerald-500 sm:w-auto"
          >
            {currentIndex === questions.length - 1 ? 'Finish Quiz' : 'Next Question'} <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
