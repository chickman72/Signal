'use client'

import React, { useState } from 'react';
import { CheckCircle, XCircle, ArrowRight, RefreshCw } from 'lucide-react';
import { QuizQuestion } from './types';
import { motion, AnimatePresence } from 'framer-motion';

interface QuizPlayerProps {
  questions: QuizQuestion[];
  onComplete: (score: number) => void; // <--- CHANGED signature
}

export default function QuizPlayer({ questions, onComplete }: QuizPlayerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [showSummary, setShowSummary] = useState(false);

  const currentQuestion = questions[currentIndex];

  const handleCheck = () => {
    if (selectedOption === null) return;
    setIsAnswered(true);
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
  };

  // --- SUMMARY VIEW ---
  if (showSummary) {
    const passed = score >= Math.ceil(questions.length / 2);
    return (
      <div className="bg-neutral-800/50 rounded-xl p-8 text-center space-y-4 border border-white/10">
        <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto ${passed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
          {passed ? <CheckCircle className="w-8 h-8" /> : <XCircle className="w-8 h-8" />}
        </div>
        <h3 className="text-2xl font-bold">{passed ? 'Chapter Complete!' : 'Needs Review'}</h3>
        <p className="text-neutral-400">You scored {score} out of {questions.length}</p>
        
        <div className="flex justify-center gap-3 pt-4">
          <button onClick={resetQuiz} className="px-4 py-2 rounded-full bg-neutral-700 hover:bg-neutral-600 transition flex items-center gap-2 text-sm">
            <RefreshCw className="w-4 h-4" /> Retry
          </button>
          
          {/* FIX: Ensure this calls onComplete with the score */}
          <button 
            onClick={() => onComplete(score)} 
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
    <div className="bg-neutral-800/50 rounded-xl p-6 border border-white/5">
       <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-neutral-500 mb-4">
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
          <h4 className="text-lg font-medium text-white">{currentQuestion.question}</h4>

          <div className="space-y-3">
            {currentQuestion.options.map((option, idx) => {
              const isSelected = selectedOption === idx;
              const isCorrect = idx === currentQuestion.correct_answer;
              let style = "border-neutral-700 hover:bg-neutral-700/50";
              if (isSelected) style = "border-indigo-500 bg-indigo-500/20 text-indigo-200";
              if (isAnswered) {
                 if (isCorrect) style = "border-emerald-500 bg-emerald-500/20 text-emerald-200";
                 else if (isSelected && !isCorrect) style = "border-red-500 bg-red-500/20 text-red-200";
                 else style = "border-neutral-700 opacity-50";
              }
              return (
                <button
                  key={idx}
                  onClick={() => !isAnswered && setSelectedOption(idx)}
                  disabled={isAnswered}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-all duration-200 ${style}`}
                >
                  <div className="flex items-center justify-between">
                    <span>{option}</span>
                    {isAnswered && isCorrect && <CheckCircle className="w-5 h-5 text-emerald-400" />}
                    {isAnswered && isSelected && !isCorrect && <XCircle className="w-5 h-5 text-red-400" />}
                  </div>
                </button>
              );
            })}
          </div>
        </motion.div>
      </AnimatePresence>

      <div className="mt-8 flex justify-end">
        {!isAnswered ? (
          <button 
            onClick={handleCheck}
            disabled={selectedOption === null}
            className="px-6 py-2 bg-white text-black font-bold rounded-full disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 transition"
          >
            Check Answer
          </button>
        ) : (
          <button 
            onClick={handleNext}
            className="px-6 py-2 bg-emerald-600 text-white font-bold rounded-full flex items-center gap-2 hover:bg-emerald-500 transition"
          >
            {currentIndex === questions.length - 1 ? 'Finish Quiz' : 'Next Question'} <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}