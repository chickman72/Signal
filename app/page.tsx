'use client'

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, ChevronRight, BookOpen, Brain, CheckCircle, Menu, Lock, X, Save, AlertTriangle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { generateCourse, generateRemediation, generateQuestionInsight } from './actions';
import { Course, AppState, User, QuizQuestion, QuizAnswer, VerificationResult, CourseProgress } from './types';
import QuizPlayer from './QuizPlayer';
import Sidebar from './Sidebar';
import { MOCK_COURSE } from './mockData';
import { loginUser, signupUser, updateUserProfile as updateUserProfileServer } from './dbActions';

const safeRandomId = () => {
  const g: any = typeof globalThis !== 'undefined' ? globalThis : undefined;
  if (g?.crypto?.randomUUID) {
    try {
      return g.crypto.randomUUID();
    } catch {
      // ignore and fallback
    }
  }
  return `${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
};

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
  const [sessionId] = useState(() => safeRandomId());
  const [authMode, setAuthMode] = useState<'LOGIN' | 'SIGNUP'>('LOGIN');
  const [signupAbout, setSignupAbout] = useState('');
  const [authError, setAuthError] = useState('');

  const fetchUserCourses = async (username: string) => {
    const res = await fetch(`/api/courses?username=${encodeURIComponent(username)}`);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error || 'Failed to load courses');
    }
    const data = await res.json();
    return (data.courses || []) as Course[];
  };

  const persistCourse = async (course: Course, username: string) => {

    const res = await fetch('/api/courses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ course, username })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.error || 'Failed to save course');
    }


    return data.saved ?? null;
  };

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
    
    if (savedUser) {
      const u = JSON.parse(savedUser);
      (async () => {
        try {
          const fresh = await loginUser(u.username);
          setUser(fresh);
          setEditName(fresh.username);
          setEditAbout(fresh.aboutMe || '');
          const userCourses = await fetchUserCourses(fresh.username);
          setCourses(userCourses);

          // Keep the library closed and let the user choose a course manually.
          setAppState('IDLE');

          const history = userCourses.reduce((acc, c) => {
            if (c.quizHistory) {
              acc[c.course_id] = c.quizHistory;
            }
            return acc;
          }, {} as Record<string, Record<number, QuizAnswer[]>>);
          setQuizHistory(history);
          localStorage.setItem('signal_courses', JSON.stringify(userCourses));
        } catch (err) {
          console.warn('Stored session invalid; please log in again.');
          localStorage.removeItem('signal_user');
          localStorage.removeItem('signal_courses');
          setAppState('AUTH');
        }
      })();
    } else {
      setAppState('AUTH');
    }
  }, []);

  useEffect(() => {
    if (courses.length > 0) {
      localStorage.setItem('signal_courses', JSON.stringify(courses));
    }
  }, [courses]);

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

  const logClientEvent = async (eventType: string, entry: Record<string, any>) => {
    try {
      await fetch('/api/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType,
          entry: {
            ...entry,
            user: user?.username ?? entry.user,
            sessionId,
            clientMeta: {
              userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'
            }
          }
        })
      });
    } catch (err) {
      // Activity logging failures are non-blocking.
    }
  };

  // --- AUTH & PROFILE HANDLERS ---
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameInput.trim()) return;
    setAuthError('');
    try {
      let account: User;
      if (authMode === 'SIGNUP') {
        account = await signupUser(usernameInput.trim(), signupAbout);
        logClientEvent('signup', { user: account.username });
      } else {
        account = await loginUser(usernameInput.trim());
        logClientEvent('login', { user: account.username });
      }

      setUser(account);
      setEditName(account.username);
      setEditAbout(account.aboutMe || '');
      localStorage.setItem('signal_user', JSON.stringify(account));

      try {
        const userCourses = await fetchUserCourses(account.username);
        setCourses(userCourses);


        const history = userCourses.reduce((acc, c) => {
          if (c.quizHistory) acc[c.course_id] = c.quizHistory;
          return acc;
        }, {} as Record<string, Record<number, QuizAnswer[]>>);
        setQuizHistory(history);
        localStorage.setItem('signal_courses', JSON.stringify(userCourses));
      } catch (err) {
        console.warn('Unable to load saved courses', err);
      }

      setAppState('IDLE');
    } catch (err: any) {
      setAuthError(err?.message || 'Unable to authenticate. Please try again.');
    }
  };

  const handleLogout = () => {
    logClientEvent('logout', {});
    setUser(null);
    localStorage.removeItem('signal_user');
    localStorage.removeItem('signal_courses');
    setAppState('AUTH');
    setCurrentCourse(null);
    setIsSidebarOpen(true);
  };

  const handleSaveProfile = () => {
    if (!user) return;
    const update = async () => {
      try {
        const updatedUser = await updateUserProfileServer(user.username, editAbout);
        setUser(updatedUser);
        localStorage.setItem('signal_user', JSON.stringify(updatedUser));
        setShowProfileModal(false);
        logClientEvent('profile_update', { user: updatedUser.username });
      } catch (err) {
        console.error(err);
        alert('Unable to update profile right now.');
      }
    };
    update();
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
    setActiveChapterId(null);
    setExpandedChapters([]);
    setRemediations({});
    setRemediationLoading({});
    setQuestionInsights({});
    setQuestionInsightLoading({});
    setAppState('PLAYING');
    if (window.innerWidth < 768) setIsSidebarOpen(false);
  };

  const updateCourseProgress = (
    courseId: string,
    chapterId: number,
    score: number,
    answers: QuizAnswer[],
    chapterQuizLength: number
  ) => {
    const baseCourse = courses.find(c => c.course_id === courseId) || currentCourse;
    if (!baseCourse) return null;

    const totalChapters = Math.max(baseCourse.chapters?.length || baseCourse.progress?.totalChapters || 0, 1);
    const existingProgress = baseCourse.progress || {
      totalChapters,
      completedChapterIds: [],
      quizScores: {},
      overallGrade: 0,
      percentComplete: 0
    };

    const completedChapterIds = Array.from(new Set([...existingProgress.completedChapterIds, chapterId]));
    const quizScores = { ...existingProgress.quizScores, [chapterId]: score };

    // Calculate totals based on actual quiz lengths instead of assuming 5 questions per chapter
    const totalPossibleScore = completedChapterIds.reduce((acc, id) => {
      const chapter = baseCourse.chapters.find(ch => ch.id === id);
      return acc + (chapter?.quiz?.length ?? chapterQuizLength ?? 0);
    }, 0);
    const totalScore = Object.values(quizScores).reduce((a, b) => a + b, 0);

    const progress: CourseProgress = {
      ...existingProgress,
      totalChapters,
      completedChapterIds,
      quizScores,
      percentComplete: Math.round((completedChapterIds.length / totalChapters) * 100),
      overallGrade: totalPossibleScore > 0 ? Math.round((totalScore / totalPossibleScore) * 100) : 0
    };

    const updatedCourse: Course = {
      ...baseCourse,
      progress,
      quizHistory: { ...(baseCourse.quizHistory || {}), [chapterId]: answers }
    };

    setCourses(prev =>
      prev.map(c => (c.course_id === courseId ? updatedCourse : c))
    );
    setCurrentCourse(cur => (cur?.course_id === courseId ? updatedCourse : cur));

    return updatedCourse;
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

    logClientEvent('quiz_submit', {
      courseId: currentCourse.course_id,
      chapterId,
      score,
      mastered,
      total: chapterQuizLength
    });

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

    const updatedCourse = updateCourseProgress(
      currentCourse.course_id,
      chapterId,
      mastered ? chapterQuizLength : score,
      answers,
      chapterQuizLength
    );

    if (updatedCourse && user?.username) {
      try {
        const saved = await persistCourse(updatedCourse, user.username);

        if (saved) {
          // Use saved result to update local state quickly
          setCourses(prev => {
            const exists = prev.find(c => c.course_id === saved.course_id);
            if (exists) return prev.map(c => c.course_id === saved.course_id ? saved : c);
            return [...prev, saved];
          });
          setCurrentCourse(saved);

          const history = saved ? { [saved.course_id]: (saved.quizHistory || {}) } : {};
          setQuizHistory(prev => ({ ...prev, ...history }));
        } else {
          // Fallback: refresh full list
          const refreshed = await fetchUserCourses(user.username);
          setCourses(refreshed);

          // Refresh currentCourse reference so UI shows persisted progress immediately
          const refreshedCurrent = refreshed.find(c => c.course_id === updatedCourse.course_id) ?? null;
          if (refreshedCurrent) {
            setCurrentCourse(refreshedCurrent);
            setActiveChapterId(null);
            setExpandedChapters([]);
          }

          const history = refreshed.reduce((acc, c) => {
            if (c.quizHistory) acc[c.course_id] = c.quizHistory;
            return acc;
          }, {} as Record<string, Record<number, QuizAnswer[]>>);
          setQuizHistory(history);
        }
      } catch (err) {
        console.warn('Failed to persist course progress', err);
      }
    }

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
          username: user?.username,
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
    logClientEvent('search', { query });
    
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
        course_id: `demo-${safeRandomId()}`, // Use fallback-safe UUID
        createdAt: new Date().toISOString() 
      };
    } else {
      // API Call
      const data = await generateCourse(query, user?.aboutMe || "", user?.username);
      
      newCourse = { 
        ...data, 
        course_id: safeRandomId(), // <--- FORCE UNIQUE ID HERE
        createdAt: new Date().toISOString() 
      };
    }

      // Save to DB and update local state
      let updatedFromServer = false;
      if (user?.username) {
        try {
          await persistCourse(newCourse, user.username);
          // Rehydrate from server to ensure we have the stored shape
          const refreshed = await fetchUserCourses(user.username);
          setCourses(refreshed);
          updatedFromServer = true;
        } catch (err) {
          console.warn('Failed to persist course to DB', err);
        }
      }
      if (!updatedFromServer) {
        setCourses(prev => [...prev, newCourse]);
      }
     
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
          <h2 className="text-3xl font-bold text-center text-white mb-2">
            {authMode === 'LOGIN' ? 'Welcome Back' : 'Create Account'}
          </h2>
          <p className="text-neutral-400 text-center mb-6">
            {authMode === 'LOGIN' ? 'Sign in to access your learning library.' : 'Create an account to get started.'}
          </p>
          <div className="flex justify-center gap-2 mb-4">
            <button
              onClick={() => { setAuthMode('LOGIN'); setAuthError(''); }}
              className={`px-4 py-2 rounded-lg text-sm font-semibold ${authMode === 'LOGIN' ? 'bg-white text-black' : 'bg-neutral-900 text-neutral-300 border border-white/10'}`}
            >
              Login
            </button>
            <button
              onClick={() => { setAuthMode('SIGNUP'); setAuthError(''); }}
              className={`px-4 py-2 rounded-lg text-sm font-semibold ${authMode === 'SIGNUP' ? 'bg-white text-black' : 'bg-neutral-900 text-neutral-300 border border-white/10'}`}
            >
              Create account
            </button>
          </div>
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
            {authMode === 'SIGNUP' && (
              <div>
                <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider ml-1">About Me (optional)</label>
                <textarea
                  value={signupAbout}
                  onChange={e => setSignupAbout(e.target.value)}
                  className="w-full mt-2 bg-neutral-900 border border-neutral-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-emerald-500 outline-none h-24 resize-none text-sm"
                  placeholder="e.g., I teach pharmacology to nursing students."
                />
              </div>
            )}
            {authError && (
              <div className="text-sm text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                {authError}
              </div>
            )}
            <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-lg transition-all transform active:scale-95">
              {authMode === 'LOGIN' ? 'Enter Signal' : 'Create Account'}
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
                                     <div data-chapter-body="true" className="pt-6 text-neutral-300 cursor-auto" onClick={e => e.stopPropagation()}>
                                       <article className="prose prose-invert prose-emerald max-w-none prose-p:text-neutral-300 prose-p:leading-relaxed prose-headings:text-white prose-headings:font-bold prose-li:text-neutral-300 prose-strong:text-white prose-strong:font-bold">
                                         <ReactMarkdown>{chapter.content_markdown}</ReactMarkdown>
                                       </article>
 
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
                                                                    userContext: user?.aboutMe || '',
                                                                    username: user?.username,
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
