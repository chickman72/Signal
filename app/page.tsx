'use client'

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, ChevronRight, BookOpen, Brain, Radio, CheckCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { generateCourse } from './actions';
import { Course, AppState } from './types';
import QuizPlayer from './QuizPlayer';
import { MOCK_COURSE } from './mockData';

export default function SignalApp() {
  const [appState, setAppState] = useState<AppState>('IDLE');
  const [query, setQuery] = useState('');
  const [course, setCourse] = useState<Course | null>(null);
  const [loadingStep, setLoadingStep] = useState(0);
  
  // Player State
  const [activeChapterId, setActiveChapterId] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  const loadingMessages = [
    "Acquiring signal...",
    "Reducing noise...",
    "Synthesizing audio...",
    "Calibrating quiz...",
    "Transmission ready..."
  ];

  // --- Handlers ---

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setAppState('GENERATING');
    
    // 1. Start the loading animation interval
    let step = 0;
    const interval = setInterval(() => {
      setLoadingStep((prev) => (prev + 1) % loadingMessages.length);
      step++;
    }, 1500);

    // 2. DEV MODE: Check for "test" keyword
    if (query.toLowerCase() === 'test') {
      console.log("Loading Mock Data...");
      setTimeout(() => {
        clearInterval(interval);
        setCourse(MOCK_COURSE);
        if(MOCK_COURSE.chapters.length > 0) setActiveChapterId(MOCK_COURSE.chapters[0].id);
        setAppState('PLAYING');
      }, 1500); 
      return;
    }

    // 3. REAL MODE: Call the API
    try {
      const data = await generateCourse(query);
      setCourse(data);
      if(data.chapters.length > 0) setActiveChapterId(data.chapters[0].id);
      
      clearInterval(interval);
      setAppState('PLAYING');
    } catch (err) {
      console.error(err);
      clearInterval(interval);
      setAppState('IDLE');
      alert("Something went wrong. Please check your API Key or try again.");
    }
  };

  // Mock Audio Player Logic
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isPlaying) {
      timer = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            setIsPlaying(false);
            return 0;
          }
          return prev + 1;
        });
      }, 100); 
    }
    return () => clearInterval(timer);
  }, [isPlaying]);

  const activeChapter = course?.chapters.find(c => c.id === activeChapterId);

  // --- Render Components ---

  return (
    <div className="min-h-screen bg-neutral-900 text-white font-sans selection:bg-emerald-500/30">
      
      {/* HEADER / NAV */}
      <nav className="p-6 flex justify-between items-center bg-black/20 backdrop-blur-md sticky top-0 z-50 border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-emerald-600 rounded-full flex items-center justify-center">
            <Radio className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-xl tracking-tight">Signal</span>
        </div>
        {appState === 'PLAYING' && (
          <button onClick={() => { setAppState('IDLE'); setQuery(''); setCourse(null); }} className="text-sm text-neutral-400 hover:text-white transition">
            New Course
          </button>
        )}
      </nav>

      <main className="max-w-3xl mx-auto px-4 relative min-h-[80vh] flex flex-col justify-center">
        
        <AnimatePresence mode="wait">
          
          {/* STATE: IDLE (Landing Page) */}
          {appState === 'IDLE' && (
            <motion.div 
              key="idle"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="text-center space-y-8"
            >
              <h1 className="text-5xl md:text-6xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-white to-neutral-500 pb-2">
                What do you want to learn?
              </h1>
              <p className="text-neutral-400 text-lg">
                Generate a complete audio-visual course in seconds.
              </p>
              
              <form onSubmit={handleSearch} className="relative max-w-lg mx-auto">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Type 'test' for demo or any topic..."
                  className="w-full bg-neutral-800/50 border border-neutral-700 rounded-full px-6 py-4 text-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all placeholder:text-neutral-600"
                  autoFocus
                />
                <button 
                  type="submit"
                  className="absolute right-2 top-2 bg-white text-black p-2 rounded-full hover:bg-neutral-200 transition"
                  disabled={!query}
                >
                  <ChevronRight />
                </button>
              </form>

              <div className="flex flex-wrap justify-center gap-3 text-sm">
                {["Nursing Informatics", "Cardiac Care", "Pediatric Triage", "Medical Ethics"].map(tag => (
                  <button 
                    key={tag}
                    onClick={() => setQuery(tag)}
                    className="px-4 py-2 bg-neutral-800/50 rounded-full border border-neutral-700 hover:border-emerald-500 transition text-neutral-400 hover:text-white"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* STATE: GENERATING (Loading) */}
          {appState === 'GENERATING' && (
            <motion.div
              key="generating"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center space-y-6"
            >
              <div className="relative w-24 h-24">
                <motion.div 
                  className="absolute inset-0 border-4 border-emerald-500/30 rounded-full" 
                />
                <motion.div 
                  className="absolute inset-0 border-4 border-t-emerald-500 rounded-full"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                   <Brain className="w-8 h-8 text-emerald-400" />
                </div>
              </div>
              <motion.p 
                key={loadingStep}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-xl font-medium text-neutral-300"
              >
                {loadingMessages[loadingStep]}
              </motion.p>
            </motion.div>
          )}

          {/* STATE: PLAYING (Course View) */}
          {appState === 'PLAYING' && course && (
            <motion.div
              key="playing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="w-full pb-32 pt-8"
            >
              {/* Course Header */}
              <div className="mb-10 text-center">
                <span className="text-xs font-bold tracking-widest text-emerald-400 uppercase mb-2 block">{course.style} COURSE</span>
                <h2 className="text-4xl font-bold mb-4">{course.title}</h2>
                <div className="h-1 w-24 bg-gradient-to-r from-emerald-500 to-teal-500 mx-auto rounded-full" />
              </div>

              {/* Chapter Feed */}
              <div className="space-y-4">
                {course.chapters.map((chapter) => {
                  const isActive = activeChapterId === chapter.id;
                  return (
                    <motion.div 
                      key={chapter.id}
                      layout
                      onClick={() => setActiveChapterId(chapter.id)}
                      className={`group cursor-pointer rounded-2xl border transition-all overflow-hidden
                        ${isActive 
                          ? 'bg-neutral-800/80 border-emerald-500/50 shadow-2xl shadow-emerald-900/20' 
                          : 'bg-neutral-900 border-neutral-800 hover:bg-neutral-800/50'
                        }`}
                    >
                      <div className="p-6 flex items-start gap-4">
                         <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold mt-1 transition-colors
                           ${isActive ? 'bg-emerald-600 text-white' : 'bg-neutral-700 text-neutral-400'}`}>
                           {chapter.id}
                         </div>
                         <div className="flex-grow">
                           <h3 className={`text-xl font-semibold mb-2 ${isActive ? 'text-white' : 'text-neutral-300'}`}>
                             {chapter.title}
                           </h3>
                           <p className="text-neutral-400 leading-relaxed text-sm">
                             {chapter.summary}
                           </p>
                           
                           {/* Expanded Content */}
                           <AnimatePresence>
                             {isActive && (
                               <motion.div 
                                 initial={{ height: 0, opacity: 0 }}
                                 animate={{ height: 'auto', opacity: 1 }}
                                 exit={{ height: 0, opacity: 0 }}
                                 className="mt-6 pt-6 border-t border-white/5 space-y-6 cursor-auto"
                                 onClick={(e) => e.stopPropagation()} // Prevent clicking content from closing chapter
                               >
                                 <div className="text-neutral-300 prose prose-invert max-w-none">
                                   <div className="flex items-center gap-2 mb-4 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                                     <BookOpen className="w-4 h-4" /> Lesson Content
                                   </div>
                                   
                                   {/* MARKDOWN RENDERING */}
                                   <ReactMarkdown
                                     components={{
                                       strong: ({node, ...props}) => <span className="font-bold text-white" {...props} />,
                                       ul: ({node, ...props}) => <ul className="list-disc pl-5 space-y-2 mb-4" {...props} />,
                                       ol: ({node, ...props}) => <ol className="list-decimal pl-5 space-y-2 mb-4" {...props} />,
                                       li: ({node, ...props}) => <li className="pl-1" {...props} />,
                                       p: ({node, ...props}) => <p className="mb-4 leading-relaxed" {...props} />,
                                       h1: ({node, ...props}) => <h3 className="text-xl font-bold text-white mb-3 mt-6" {...props} />,
                                       h2: ({node, ...props}) => <h4 className="text-lg font-bold text-white mb-2 mt-4" {...props} />,
                                       h3: ({node, ...props}) => <h5 className="text-md font-bold text-white mb-2 mt-4" {...props} />,
                                     }}
                                   >
                                     {chapter.content_markdown}
                                   </ReactMarkdown>
                                 </div>
                                 
                                 {/* QUIZ SECTION */}
                                 <div className="mt-8 border-t border-white/5 pt-8">
                                    <div className="flex items-center gap-2 mb-4 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                                       <CheckCircle className="w-4 h-4" /> Knowledge Check
                                    </div>
                                    <QuizPlayer 
                                      questions={chapter.quiz} 
                                      onComplete={() => {
                                        const currentIndex = course.chapters.findIndex(c => c.id === chapter.id);
                                        // If there is a next chapter, open it
                                        if (currentIndex < course.chapters.length - 1) {
                                          setActiveChapterId(course.chapters[currentIndex + 1].id);
                                        } else {
                                          alert("Course Completed! Great job.");
                                        }
                                      }}
                                    />
                                 </div>

                               </motion.div>
                             )}
                           </AnimatePresence>
                         </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* PERSISTENT PLAYER BAR */}
      <AnimatePresence>
        {appState === 'PLAYING' && activeChapter && (
          <motion.div 
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            className="fixed bottom-0 left-0 right-0 bg-neutral-900/90 backdrop-blur-xl border-t border-white/10 p-4 md:p-6 z-50"
          >
            <div className="max-w-3xl mx-auto flex items-center gap-6">
              <button 
                onClick={() => setIsPlaying(!isPlaying)}
                className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-black hover:scale-105 transition active:scale-95 shadow-lg shadow-white/10"
              >
                {isPlaying ? <Pause className="fill-current" /> : <Play className="fill-current ml-1" />}
              </button>
              
              <div className="flex-grow space-y-2">
                <div className="flex justify-between text-sm">
                   <span className="font-semibold text-white">{activeChapter.title}</span>
                   <span className="text-neutral-400 text-xs uppercase tracking-wider">Audio Lesson</span>
                </div>
                {/* Progress Bar */}
                <div className="h-1.5 bg-neutral-700 rounded-full overflow-hidden">
                  <motion.div 
                    className="h-full bg-emerald-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}