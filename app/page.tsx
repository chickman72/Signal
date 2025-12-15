'use client'

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, ChevronRight, BookOpen, Brain, CheckCircle, Menu, Lock, X, Save } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { generateCourse } from './actions';
import { Course, AppState, User } from './types';
import QuizPlayer from './QuizPlayer';
import Sidebar from './Sidebar';
import { MOCK_COURSE } from './mockData';

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
  const [activeChapterId, setActiveChapterId] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [loadingStep, setLoadingStep] = useState(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showProfileModal, setShowProfileModal] = useState(false); // <--- NEW MODAL STATE

  // Profile Edit Inputs
  const [editName, setEditName] = useState('');
  const [editAbout, setEditAbout] = useState('');

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
    if (window.innerWidth < 768) setIsSidebarOpen(false);
  };

  const handleSelectCourse = (course: Course) => {
    setCurrentCourse(course);
    if(course.chapters.length > 0) setActiveChapterId(course.chapters[0].id);
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
        newCourse = { ...MOCK_COURSE, course_id: `demo-${Date.now()}`, createdAt: new Date().toISOString() };
      } else {
        // PASS USER CONTEXT HERE
        const data = await generateCourse(query, user?.aboutMe || "");
        newCourse = { ...data, createdAt: new Date().toISOString() };
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
                       <h2 className="text-4xl font-bold mt-2">{currentCourse.title}</h2>
                       <div className="mt-4 flex items-center gap-4 text-sm text-neutral-400">
                          <span>{currentCourse.chapters.length} Chapters</span>
                          <span>•</span>
                          <span>{currentCourse.progress?.percentComplete || 0}% Complete</span>
                       </div>
                    </div>

                    <div className="space-y-4">
                      {currentCourse.chapters.map((chapter) => {
                         const isActive = activeChapterId === chapter.id;
                         return (
                           <motion.div 
                             key={chapter.id}
                             onClick={() => setActiveChapterId(chapter.id)}
                             className={`rounded-2xl border cursor-pointer transition-all overflow-hidden ${isActive ? 'bg-neutral-800 border-emerald-500/50' : 'bg-neutral-900 border-neutral-800 hover:bg-neutral-800'}`}
                           >
                             <div className="p-6">
                               <h3 className={`text-xl font-bold ${isActive ? 'text-white' : 'text-neutral-400'}`}>
                                 {chapter.id}. {chapter.title}
                               </h3>
                               <AnimatePresence>
                                 {isActive && (
                                   <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}>
                                      <div className="pt-6 text-neutral-300 prose prose-invert max-w-none cursor-auto" onClick={e => e.stopPropagation()}>
                                         <ReactMarkdown>{chapter.content_markdown}</ReactMarkdown>
                                         
                                         <div className="mt-8 pt-8 border-t border-white/5">
                                            <div className="flex items-center gap-2 mb-4 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                                               <CheckCircle className="w-4 h-4" /> Knowledge Check
                                            </div>
                                            <QuizPlayer 
                                               questions={chapter.quiz}
                                               onComplete={(score) => {
                                                  // 1. Save Progress
                                                  updateCourseProgress(currentCourse.course_id, chapter.id, score); 
                                                  
                                                  // 2. Advance to Next Chapter
                                                  const idx = currentCourse.chapters.findIndex(c => c.id === chapter.id);
                                                  if (idx < currentCourse.chapters.length - 1) {
                                                     const nextId = currentCourse.chapters[idx + 1].id;
                                                     setActiveChapterId(nextId);
                                                     
                                                     // Optional: Smooth scroll to the next chapter
                                                     setTimeout(() => {
                                                       const el = document.getElementById(`chapter-${nextId}`);
                                                       el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                     }, 300);
                                                  } else {
                                                     alert("Course Completed! Check your library for the final grade.");
                                                  }
                                               }}
                                            />
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