'use client'

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, ChevronRight, BookOpen, Brain, CheckCircle, Menu, Lock, X, Save, AlertTriangle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { generateCourse, generateRemediation, generateQuestionInsight } from './actions';
import { Course, AppState, User, QuizQuestion, QuizAnswer, VerificationResult } from './types';
import QuizPlayer from './QuizPlayer';
import Sidebar from './Sidebar';
import { MOCK_COURSE } from './mockData';

const TRUST_STYLE_MAP: Record<VerificationResult['status'], { bg: string; border: string; text: string; icon: React.ReactNode }> = {
  VERIFIED: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/40', text: 'text-emerald-300', icon: <CheckCircle className="w-5 h-5" /> },
  CAUTION: { bg: 'bg-amber-500/10', border: 'border-amber-500/40', text: 'text-amber-300', icon: <AlertTriangle className="w-5 h-5" /> },
  FLAGGED: { bg: 'bg-rose-500/10', border: 'border-rose-500/40', text: 'text-rose-300', icon: <AlertTriangle className="w-5 h-5" /> },
};

export default function SignalApp() {
  // --- STATE ---
  const [appState, setAppState] = useState<AppState>('AUTH');
  const [user, setUser] = useState<User | null>(null);
  const [usernameInput, setUsernameInput] = useState('');
  
  // Data
  const [courses, setCourses] = useState<Course[]>([]);
  const [currentCourse, setCurrentCourse] = useState<Course | null>(null);
  
  // UI State
  const [query, setQuery] = useState('');
  const [activeChapterId, setActiveChapterId] = useState<number | null>(null);
  const [expandedChapters, setExpandedChapters] = useState<number[]>([]);
  const [remediations, setRemediations] = useState<Record<number, { explanation_markdown: string; quiz: QuizQuestion[] }>>({});
  const [remediationLoading, setRemediationLoading] = useState<Record<number, boolean>>({});
  const [quizHistory, setQuizHistory] = useState<Record<string, Record<number, QuizAnswer[]>>>({});
  const [questionInsights, setQuestionInsights] = useState<Record<number, Record<number, string>>>({});
  const [questionInsightLoading, setQuestionInsightLoading] = useState<Record<number, Record<number, boolean>>>({});
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [loadingStep, setLoadingStep] = useState(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showProfileModal, setShowProfileModal] = useState(false); // <--- NEW MODAL STATE

  // Profile Edit Inputs
  const [editName, setEditName] = useState('');
  const [editAbout, setEditAbout] = useState('');

  const activeCourseProgress = currentCourse
    ? courses.find(c => c.course_id === currentCourse.course_id)?.progress
    : undefined;

  const currentVerification = currentCourse?.verification;
  const trustStatus: VerificationResult['status'] = currentVerification?.status ?? 'CAUTION';
  const trustStyle = TRUST_STYLE_MAP[trustStatus];
  const trustScore = typeof currentVerification?.score === 'number' ? Math.round(currentVerification.score) : 0;
  const trustNotes = currentVerification?.notes || 'Automated safety review pending.';
  const originalVerification = currentCourse?.originalVerification || currentVerification;
  const initialScore = typeof originalVerification?.score === 'number' ? Math.round(originalVerification.score) : trustScore;
  const initialNotes = originalVerification?.notes;

  // --- PERSISTENCE ---
  useEffect(() => {
    const savedUser = localStorage.getItem('signal_user');
    const savedCourses = localStorage.getItem('signal_courses');
    
    if (savedUser) {
      const u = JSON.parse(savedUser);
      setUser(u);
      setEditName(u.username);
      setEditAbout(u.aboutMe || '');
      setAppState('IDLE');
    }
    if (savedCourses) {
      setCourses(JSON.parse(savedCourses));
    }
  }, []);

  useEffect(() => {
    if (courses.length > 0) {
      localStorage.setItem('signal_courses', JSON.stringify(courses));
    }
  }, [courses]);

  useEffect(() => {
    const storedHistory = localStorage.getItem('signal_quiz_history');
    if (storedHistory) {
      try {
        setQuizHistory(JSON.parse(storedHistory));
      } catch {
        console.warn("Failed to parse quiz history");
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('signal_quiz_history', JSON.stringify(quizHistory));
  }, [quizHistory]);

  // --- AUTH & PROFILE HANDLERS ---
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameInput.trim()) return;
    const newUser = { username: usernameInput, aboutMe: '' };
    setUser(newUser);
    setEditName(newUser.username);
    localStorage.setItem('signal_user', JSON.stringify(newUser));
    setAppState('IDLE');
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('signal_user');
    setAppState('AUTH');
    setCurrentCourse(null);
    setIsSidebarOpen(true);
  };

  const handleSaveProfile = () => {
    if (!user) return;
    const updatedUser = { ...user, username: editName, aboutMe: editAbout };
    setUser(updatedUser);
    localStorage.setItem('signal_user', JSON.stringify(updatedUser));
    setShowProfileModal(false);
  };

  // --- COURSE HANDLERS ---
  const handleNewCourse = () => {
    setCurrentCourse(null);
    setQuery('');
    setAppState('IDLE');
    setActiveChapterId(null);
    setExpandedChapters([]);
    setRemediations({});
    setRemediationLoading({});
    setQuizHistory({});
    setQuestionInsights({});
    setQuestionInsightLoading({});
    if (window.innerWidth < 768) setIsSidebarOpen(false);
  };

  const handleSelectCourse = (course: Course) => {
    setCurrentCourse(course);
    const firstChapterId = course.chapters[0]?.id ?? null;
    setActiveChapterId(firstChapterId);
    setExpandedChapters(firstChapterId ? [firstChapterId] : []);
    setRemediations({});
    setRemediationLoading({});
    setQuestionInsights({});
    setQuestionInsightLoading({});
    setAppState('PLAYING');
    if (window.innerWidth < 768) setIsSidebarOpen(false);
  };

  const updateCourseProgress = (courseId: string, chapterId: number, score: number) => {
    setCourses(prevCourses => {
      return prevCourses.map(c => {
        if (c.course_id !== courseId) return c;

        const prog = c.progress || { 
          totalChapters: c.chapters.length, 
          completedChapterIds: [], 
          quizScores: {}, 
          overallGrade: 0, 
          percentComplete: 0 
        };

        if (!prog.completedChapterIds.includes(chapterId)) {
          prog.completedChapterIds.push(chapterId);
        }
        prog.quizScores[chapterId] = score;

        prog.percentComplete = Math.round((prog.completedChapterIds.length / prog.totalChapters) * 100);
        const totalScore = Object.values(prog.quizScores).reduce((a, b) => a + b, 0);
        const maxPossibleScore = prog.completedChapterIds.length * 5; 
        prog.overallGrade = maxPossibleScore > 0 ? Math.round((totalScore / maxPossibleScore) * 100) : 100;

        return { ...c, progress: prog };
      });
    });
  };

  const toggleChapter = (chapterId: number) => {
    setExpandedChapters(prev => {
      const isOpen = prev.includes(chapterId);
      if (isOpen) {
        setActiveChapterId(current => (current === chapterId ? null : current));
        return [];
      }
      setActiveChapterId(chapterId);
      return [chapterId];
    });
  };

  const advanceToNextChapter = (chapterId: number) => {
    if (!currentCourse) return;
    const idx = currentCourse.chapters.findIndex(c => c.id === chapterId);
    if (idx < currentCourse.chapters.length - 1) {
      const nextId = currentCourse.chapters[idx + 1].id;
      setActiveChapterId(nextId);
      setExpandedChapters([nextId]);

      setTimeout(() => {
        const el = document.getElementById(`chapter-${nextId}`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    } else {
      alert("Course Completed! Check your library for the final grade.");
    }
  };

  const handleQuizCompletion = async (
    chapterId: number,
    chapterTitle: string,
    chapterContent: string,
    chapterQuizLength: number,
    result: { score: number; wrongQuestions: QuizQuestion[]; answers: QuizAnswer[] }
  ) => {
    if (!currentCourse) return;
    const { score, wrongQuestions, answers } = result;
    const mastered = wrongQuestions.length === 0;

    setQuizHistory(prev => {
      const courseHistory = prev[currentCourse.course_id] || {};
      return {
        ...prev,
        [currentCourse.course_id]: {
          ...courseHistory,
          [chapterId]: answers,
        }
      };
    });

    updateCourseProgress(
      currentCourse.course_id,
      chapterId,
      mastered ? chapterQuizLength : score
    );

    if (mastered) {
      setRemediations(prev => {
        const next = { ...prev };
        delete next[chapterId];
        return next;
      });
      return;
    }

    setRemediationLoading(prev => ({ ...prev, [chapterId]: true }));
    try {
      const remediation = await generateRemediation({
        courseTitle: currentCourse.title,
        chapterTitle,
        chapterContent,
        missedQuestions: wrongQuestions,
        userContext: user?.aboutMe || '',
      });
      setRemediations(prev => ({ ...prev, [chapterId]: remediation }));
    } catch (err) {
      console.error(err);
      alert("Unable to generate remediation for this chapter. Please try again.");
    } finally {
      setRemediationLoading(prev => ({ ...prev, [chapterId]: false }));
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setAppState('GENERATING');
    
    let step = 0;
    const interval = setInterval(() => {
      setLoadingStep((prev) => (prev + 1) % 5);
      step++;
    }, 1500);

    try {
      let newCourse: Course;
      
    if (query.toLowerCase() === 'test') {
      await new Promise(r => setTimeout(r, 2000));
      newCourse = { 
        ...MOCK_COURSE, 
        course_id: `demo-${crypto.randomUUID()}`, // Use crypto for uniqueness
        createdAt: new Date().toISOString() 
      };
    } else {
      // API Call
      const data = await generateCourse(query, user?.aboutMe || "");
      
      newCourse = { 
        ...data, 
        course_id: crypto.randomUUID(), // <--- FORCE UNIQUE ID HERE
        createdAt: new Date().toISOString() 
      };
    }

      // ADD TO END OF LIST (Underneath)
      setCourses(prev => [...prev, newCourse]); 
      
      handleSelectCourse(newCourse);
      
    } catch (err) {
      console.error(err);
      alert("Error generating course.");
      setAppState('IDLE');
    } finally {
      clearInterval(interval);
    }
  };

  // --- VIEW RENDERERS ---

  if (appState === 'AUTH') {
    return (
      <div className="min-h-screen bg-neutral-900 flex items-center justify-center p-4">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }} 
          animate={{ scale: 1, opacity: 1 }}
          className="max-w-md w-full bg-neutral-800 rounded-2xl p-8 border border-white/10 shadow-2xl"
        >
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-emerald-600 rounded-full flex items-center justify-center shadow-lg shadow-emerald-900/50">
               <Lock className="w-8 h-8 text-white" />
            </div>
          </div>
          <h2 className="text-3xl font-bold text-center text-white mb-2">Welcome Back</h2>
          <p className="text-neutral-400 text-center mb-8">Sign in to access your learning library.</p>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider ml-1">Username</label>
              <input 
                type="text" 
                value={usernameInput}
                onChange={e => setUsernameInput(e.target.value)}
                className="w-full mt-2 bg-neutral-900 border border-neutral-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                placeholder="Dr. Smith"
                autoFocus
              />
            </div>
            <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-lg transition-all transform active:scale-95">
              Enter Signal
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-900 text-white font-sans selection:bg-emerald-500/30 flex overflow-hidden">
      
      {/* SIDEBAR */}
      <Sidebar 
        isOpen={isSidebarOpen}
        user={user!}
        courses={courses}
        activeCourseId={currentCourse?.course_id}
        onSelectCourse={handleSelectCourse}
        onNewCourse={handleNewCourse}
        onLogout={handleLogout}
        onEditProfile={() => setShowProfileModal(true)}
      />

      {/* PROFILE MODAL */}
      <AnimatePresence>
        {showProfileModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
             <motion.div 
               initial={{ scale: 0.9, opacity: 0 }}
               animate={{ scale: 1, opacity: 1 }}
               exit={{ scale: 0.9, opacity: 0 }}
               className="w-full max-w-md bg-neutral-800 rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
             >
                <div className="p-6 border-b border-white/5 flex justify-between items-center">
                  <h3 className="text-xl font-bold">Edit Profile</h3>
                  <button onClick={() => setShowProfileModal(false)} className="text-neutral-400 hover:text-white">
                    <X className="w-5 h-5"/>
                  </button>
                </div>
                <div className="p-6 space-y-4">
                   <div>
                     <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">Display Name</label>
                     <input 
                       value={editName}
                       onChange={e => setEditName(e.target.value)}
                       className="w-full bg-neutral-900 border border-neutral-700 rounded-lg p-3 text-white focus:outline-none focus:border-emerald-500"
                     />
                   </div>
                   <div>
                     <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">About Me (Context for AI)</label>
                     <textarea 
                       value={editAbout}
                       onChange={e => setEditAbout(e.target.value)}
                       className="w-full h-32 bg-neutral-900 border border-neutral-700 rounded-lg p-3 text-white focus:outline-none focus:border-emerald-500 resize-none text-sm leading-relaxed"
                       placeholder="e.g. I am a cardiac nurse with 10 years experience. I prefer visual analogies."
                     />
                   </div>
                   <button 
                     onClick={handleSaveProfile}
                     className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 mt-2"
                   >
                     <Save className="w-4 h-4"/> Save Profile
                   </button>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MAIN CONTENT AREA */}
      <motion.div 
        layout
        className="flex-grow relative h-screen overflow-y-auto"
        style={{ marginLeft: isSidebarOpen ? 280 : 0 }}
      >
         {/* Toggle Sidebar Button */}
         <button 
           onClick={() => setIsSidebarOpen(!isSidebarOpen)}
           className="absolute top-6 left-6 z-40 p-2 bg-neutral-800 rounded-full hover:bg-neutral-700 transition shadow-lg"
         >
           <Menu className="w-5 h-5 text-neutral-400" />
         </button>

         <main className="max-w-4xl mx-auto px-4 py-20 min-h-[80vh]">
            
            <AnimatePresence mode="wait">
              {/* IDLE: SEARCH */}
              {appState === 'IDLE' && (
                <motion.div 
                   key="idle"
                   initial={{ opacity: 0, y: 20 }}
                   animate={{ opacity: 1, y: 0 }}
                   exit={{ opacity: 0, y: -20 }}
                   className="text-center mt-20"
                >
                  <h1 className="text-5xl font-bold mb-6">Hello, {user?.username}.</h1>
                  <p className="text-xl text-neutral-400 mb-8">What are we learning today?</p>
                  <form onSubmit={handleSearch} className="relative max-w-lg mx-auto">
                    <input
                      value={query}
                      onChange={e => setQuery(e.target.value)}
                      placeholder="e.g. Advanced Pharmacokinetics"
                      className="w-full bg-neutral-800/50 border border-neutral-700 rounded-full px-6 py-4 text-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all placeholder:text-neutral-600"
                    />
                    <button type="submit" className="absolute right-2 top-2 bg-white text-black p-2 rounded-full hover:bg-neutral-200">
                      <ChevronRight />
                    </button>
                  </form>
                </motion.div>
              )}

              {/* GENERATING */}
              {appState === 'GENERATING' && (
                 <motion.div key="gen" className="text-center mt-32">
                    <div className="w-16 h-16 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto mb-6"/>
                    <p className="text-xl text-neutral-300 animate-pulse">Designing your course...</p>
                 </motion.div>
              )}

              {/* PLAYING */}
              {appState === 'PLAYING' && currentCourse && (
                 <motion.div key="play" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <div className="mb-12 border-b border-white/10 pb-8">
                       <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest">{currentCourse.style} COURSE</span>
                       <div className={`mt-3 inline-flex items-start gap-3 rounded-xl border px-4 py-3 ${trustStyle.bg} ${trustStyle.border}`}>
                         <div className={`flex h-10 w-10 items-center justify-center rounded-full border ${trustStyle.border} bg-black/20`}>
                           {React.cloneElement(trustStyle.icon as React.ReactElement<any>, { className: `w-5 h-5 ${trustStyle.text}` })}
                         </div>
                         <div className="flex flex-col gap-1">
                           <div className="flex items-center gap-2">
                             <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">Trust Signal</div>
                             {currentCourse.wasRefined && (
                               <span className="text-[10px] font-semibold text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">
                                 Refined
                               </span>
                             )}
                           </div>
                           {currentCourse.wasRefined ? (
                             <>
                               <div className="flex items-center gap-2 flex-wrap">
                                 <span className="text-sm text-neutral-400 line-through">Initial {initialScore}%</span>
                                 <span className="text-neutral-500 text-xs">-&gt;</span>
                                 <span className="text-2xl font-bold text-white">{trustScore}%</span>
                                 <span className={`text-sm font-semibold ${trustStyle.text}`}>{trustStatus}</span>
                               </div>
                               <p className="text-xs text-neutral-200 leading-snug">Final: {trustNotes}</p>
                               {initialNotes && (
                                 <p className="text-[11px] text-neutral-500 leading-snug">Initial: {initialNotes}</p>
                               )}
                             </>
                           ) : (
                             <>
                               <div className="flex items-baseline gap-2">
                                 <span className="text-2xl font-bold text-white">{trustScore}%</span>
                                 <span className={`text-sm font-semibold ${trustStyle.text}`}>{trustStatus}</span>
                               </div>
                               <p className="text-xs text-neutral-200 leading-snug">{trustNotes}</p>
                             </>
                           )}
                         </div>
                       </div>
                       <h2 className="text-4xl font-bold mt-2">{currentCourse.title}</h2>
                       <div className="mt-4 flex items-center gap-4 text-sm text-neutral-400">
                          <span>{currentCourse.chapters.length} Chapters</span>
                          <span>•</span>
                          <span>{currentCourse.progress?.percentComplete || 0}% Complete</span>
                       </div>
                    </div>

                    <div className="space-y-4">
                      {currentCourse.chapters.map((chapter) => {
                         const isExpanded = expandedChapters.includes(chapter.id) || activeChapterId === chapter.id;
                         const chapterScore = activeCourseProgress?.quizScores?.[chapter.id];
                         const knowledgePercent = typeof chapterScore === 'number'
                           ? Math.round((chapterScore / Math.max(1, chapter.quiz.length)) * 100)
                           : 0;
                         return (
                           <motion.div 
                             key={chapter.id}
                             id={`chapter-${chapter.id}`}
                             onClick={(e) => {
                               const target = e.target as HTMLElement;
                               if (target.closest('[data-chapter-body="true"]')) return;
                               toggleChapter(chapter.id);
                             }}
                             className={`rounded-2xl border cursor-pointer transition-all overflow-hidden ${isExpanded ? 'bg-neutral-800 border-emerald-500/50' : 'bg-neutral-900 border-neutral-800 hover:bg-neutral-800'}`}
                           >
                             <div className="p-6">
                               <div className="flex items-center justify-between gap-3">
                                 <h3 className={`text-xl font-bold ${isExpanded ? 'text-white' : 'text-neutral-400'}`}>
                                   {chapter.id}. {chapter.title}
                                 </h3>
                                 <div className="flex items-center gap-2 text-xs">
                                   <span className="text-neutral-500">Knowledge Check</span>
                                   <span className="px-2 py-1 rounded-full bg-white/10 text-white font-semibold">{knowledgePercent}%</span>
                                   <ChevronRight className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90 text-emerald-400' : 'text-neutral-500'}`} />
                                 </div>
                               </div>
                               <AnimatePresence>
                                 {isExpanded && (
                                   <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}>
                                     <div data-chapter-body="true" className="pt-6 text-neutral-300 prose prose-invert max-w-none cursor-auto" onClick={e => e.stopPropagation()}>
                                         <ReactMarkdown>{chapter.content_markdown}</ReactMarkdown>
                                         
                                         <div className="mt-8 pt-8 border-t border-white/5">
                                            <div className="flex items-center gap-2 mb-4 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                                               <CheckCircle className="w-4 h-4" /> Knowledge Check
                                            </div>
                                            <QuizPlayer 
                                               questions={chapter.quiz}
                                               onComplete={async (result) => {
                                                  await handleQuizCompletion(
                                                    chapter.id,
                                                    chapter.title,
                                                    chapter.content_markdown,
                                                    chapter.quiz.length,
                                                    result
                                                  );

                                                  if (result.wrongQuestions.length === 0) {
                                                   advanceToNextChapter(chapter.id);
                                                  }
                                               }}
                                            />
                                            {quizHistory[currentCourse.course_id]?.[chapter.id] && (
                                              <div className="mt-4 p-4 rounded-lg bg-neutral-900/70 border border-white/5">
                                                <div className="text-sm font-semibold text-white mb-3">Your last answers</div>
                                                <div className="space-y-3">
                                                  {quizHistory[currentCourse.course_id][chapter.id].map((entry, idx) => {
                                                    const correctText = entry.question.options[entry.question.correct_answer] ?? '';
                                                    const chosen = typeof entry.selectedOption === 'number' ? entry.question.options[entry.selectedOption] : 'No answer';
                                                    return (
                                                      <div key={idx} className="text-sm text-neutral-300 border-b border-white/5 pb-2 last:border-b-0 last:pb-0">
                                                        <div className="font-medium text-white mb-1">{idx + 1}. {entry.question.question}</div>
                                                        <div className="text-xs">
                                                          <span className={`font-semibold ${entry.isCorrect ? 'text-emerald-400' : 'text-amber-400'}`}>
                                                            {entry.isCorrect ? 'Correct' : 'Incorrect'}
                                                          </span>
                                                          <span className="text-neutral-500"> — You chose: </span>
                                                          <span className="text-white">{chosen}</span>
                                                        </div>
                                                        {!entry.isCorrect && (
                                                          <div className="mt-2">
                                                            <button
                                                              className="text-xs text-emerald-400 hover:text-emerald-300 underline"
                                                              onClick={async () => {
                                                                setQuestionInsightLoading(prev => ({
                                                                  ...prev,
                                                                  [chapter.id]: { ...(prev[chapter.id] || {}), [idx]: true }
                                                                }));
                                                                try {
                                                                  const insight = await generateQuestionInsight({
                                                                    courseTitle: currentCourse.title,
                                                                    chapterTitle: chapter.title,
                                                                    question: entry.question,
                                                                    userContext: user?.aboutMe || ''
                                                                  });
                                                                  setQuestionInsights(prev => ({
                                                                    ...prev,
                                                                    [chapter.id]: {
                                                                      ...(prev[chapter.id] || {}),
                                                                      [idx]: insight.explanation_markdown
                                                                    }
                                                                  }));
                                                                } catch (e) {
                                                                  console.error(e);
                                                                  alert("Couldn't fetch more info for this question right now.");
                                                                } finally {
                                                                  setQuestionInsightLoading(prev => ({
                                                                    ...prev,
                                                                    [chapter.id]: { ...(prev[chapter.id] || {}), [idx]: false }
                                                                  }));
                                                                }
                                                              }}
                                                            >
                                                              Tell me more
                                                            </button>
                                                            {questionInsightLoading[chapter.id]?.[idx] && (
                                                              <span className="ml-2 text-xs text-neutral-400">Loading…</span>
                                                            )}
                                                            {questionInsights[chapter.id]?.[idx] && (
                                                              <div className="mt-2 prose prose-invert text-neutral-200 max-w-none">
                                                                <ReactMarkdown>{questionInsights[chapter.id][idx]}</ReactMarkdown>
                                                              </div>
                                                            )}
                                                          </div>
                                                        )}
                                                        {!entry.isCorrect && (
                                                          <div className="text-xs text-neutral-500 mt-1">
                                                            Correct answer: <span className="text-white">{correctText}</span>
                                                          </div>
                                                        )}
                                                      </div>
                                                    );
                                                  })}
                                                </div>
                                              </div>
                                            )}
                                            {remediationLoading[chapter.id] && (
                                              <div className="mt-4 text-sm text-neutral-400">Building a focused review...</div>
                                            )}
                                            {remediations[chapter.id] && (
                                              <div className="mt-6 p-5 rounded-xl border border-white/10 bg-neutral-800/60">
                                                <div className="flex items-center justify-between mb-3">
                                                  <span className="text-sm font-semibold text-white">Targeted Review</span>
                                                  <span className="text-xs text-neutral-400">Missed concepts</span>
                                                </div>
                                                <div className="prose prose-invert text-neutral-300 max-w-none">
                                                  <ReactMarkdown>{remediations[chapter.id].explanation_markdown}</ReactMarkdown>
                                                </div>
                                                <div className="mt-4">
                                                  <QuizPlayer
                                                    questions={remediations[chapter.id].quiz}
                                                    onComplete={async (result) => {
                                                      await handleQuizCompletion(
                                                        chapter.id,
                                                        chapter.title,
                                                        chapter.content_markdown,
                                                        chapter.quiz.length,
                                                        result
                                                      );
                                                      if (result.wrongQuestions.length === 0) {
                                                        advanceToNextChapter(chapter.id);
                                                      }
                                                    }}
                                                  />
                                                </div>
                                              </div>
                                            )}
                                         </div>
                                      </div>
                                   </motion.div>
                                 )}
                               </AnimatePresence>
                             </div>
                           </motion.div>
                         )
                      })}
                    </div>
                 </motion.div>
              )}
            </AnimatePresence>
         </main>
      </motion.div>
    </div>
  );
}
