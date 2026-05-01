'use client'

import React from 'react';
import { motion } from 'framer-motion';
import { LogOut, PlusCircle, Radio, Settings, Trash2, Shield } from 'lucide-react';
import { Course, User } from './types';

interface SidebarProps {
  user: User;
  courses: Course[];
  activeCourseId: string | undefined;
  onSelectCourse: (course: Course) => void;
  onNewCourse: () => void;
  onDeleteCourse: (course: Course) => void;
  onLogout: () => void;
  onEditProfile: () => void; // <--- NEW PROP
  isOpen: boolean;
}

export default function Sidebar({ 
  user, 
  courses, 
  activeCourseId, 
  onSelectCourse, 
  onNewCourse,
  onDeleteCourse,
  onLogout,
  onEditProfile,
  isOpen
}: SidebarProps) {
  const trimmedDisplayName = user.displayName?.trim();
  const hasLegacyName = user.username && user.email && user.username !== user.email;
  const profileName = trimmedDisplayName || (hasLegacyName ? user.username : "");
  const sidebarName = profileName || user.email || user.username;
  const avatarSeed = sidebarName || "User";
  
  return (
    <motion.div 
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: isOpen ? 280 : 0, opacity: isOpen ? 1 : 0 }}
      className="fixed left-0 top-0 z-40 flex h-dvh max-w-[86vw] flex-col overflow-hidden whitespace-nowrap border-r border-slate-200 bg-white/95 shadow-xl shadow-slate-200/80 backdrop-blur-xl md:bg-white/90 md:shadow-none"
    >
      {/* Brand Header */}
      <div className="flex items-center gap-3 border-b border-slate-200 p-4 sm:p-6">
        <div className="w-8 h-8 bg-emerald-600 rounded-full flex items-center justify-center flex-shrink-0">
          <Radio className="w-4 h-4 text-white" />
        </div>
        <span className="font-bold text-xl tracking-tight text-slate-950">Signal</span>
      </div>

      {/* Course List (Top) */}
      {/* ADDED 'flex flex-col' to ensure vertical stacking */}
      <div className="flex flex-grow flex-col gap-2 overflow-y-auto p-3 sm:p-4"> 
        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 px-2">
          Your Library
        </div>
        
        {courses.map((course) => {
          const isActive = activeCourseId === course.course_id;
          const percent = course.progress?.percentComplete || 0;
          const grade = course.progress?.overallGrade || 0;

          return (
            <div
              key={course.course_id}
              className={`w-full rounded-xl transition-all group relative overflow-hidden flex-shrink-0
                ${isActive ? 'bg-slate-100 text-slate-950' : 'text-slate-600 hover:bg-white hover:text-slate-800'}
              `}
            >
              <button
                onClick={() => onSelectCourse(course)}
                title={course.title}
                className="w-full text-left p-3"
              >
                <div className="mb-1 grid grid-cols-[minmax(0,1fr)_auto_auto] items-start gap-2 pr-1">
                  <span className="truncate font-medium">{course.title}</span>
                  {percent > 0 && (
                    <span className={`text-xs font-bold ${grade >= 70 ? 'text-emerald-700' : 'text-amber-700'}`}>
                      {grade}%
                    </span>
                  )}
                  <span className="h-4 w-4" aria-hidden="true" />
                </div>

                <div className="h-1 w-full bg-slate-200 rounded-full overflow-hidden mt-2">
                  <div
                    className={`h-full ${percent === 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onDeleteCourse(course);
                }}
                className="absolute right-2 top-3 text-slate-500 hover:text-rose-700"
                title="Delete course"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          );
        })}

        {courses.length === 0 && (
          <div className="text-sm text-slate-400 italic px-2">No courses yet.</div>
        )}
      </div>

      {/* New Course Button */}
      <div className="border-t border-slate-200 p-3 sm:p-4">
        <button 
          onClick={onNewCourse}
          className="w-full flex items-center gap-3 p-3 rounded-xl bg-emerald-600/20 text-emerald-700 hover:bg-emerald-600 hover:text-white transition group"
        >
          <PlusCircle className="w-5 h-5" />
          <span className="font-semibold">New Course</span>
        </button>
      </div>

      {user.role === "administrator" ? (
        <div className="px-3 pb-3 sm:px-4 sm:pb-4">
          <a
            href="/admin"
            className="w-full flex items-center gap-3 p-3 rounded-xl text-slate-600 hover:bg-white hover:text-slate-800 transition"
          >
            <Shield className="w-5 h-5" />
            <span className="font-semibold">Admin</span>
          </a>
        </div>
      ) : null}

      {/* User Profile (Bottom) */}
      <div className="border-t border-slate-200 bg-slate-100/80 p-3 sm:p-4">
        <div className="flex items-center gap-3">
          {/* Clicking avatar opens profile too */}
          <button onClick={onEditProfile} className="w-10 h-10 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-white font-bold shadow-lg hover:scale-105 transition">
             {avatarSeed.substring(0,2).toUpperCase()}
          </button>
          <div className="flex-grow min-w-0">
            <button onClick={onEditProfile} className="text-left hover:underline">
               <div className="font-medium text-slate-950 truncate">{sidebarName}</div>
            </button>
            <div className="text-xs text-slate-500 truncate max-w-[100px]">{user.aboutMe ? 'Customized' : 'Free Plan'}</div>
          </div>
          
          <div className="flex gap-1">
             <button onClick={onEditProfile} className="text-slate-600 hover:text-slate-950 p-1 transition" title="Edit Profile">
               <Settings className="w-4 h-4" />
             </button>
             <button onClick={onLogout} className="text-slate-600 hover:text-slate-950 p-1 transition" title="Logout">
               <LogOut className="w-4 h-4" />
             </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
