'use client'

import React from 'react';
import { motion } from 'framer-motion';
import { LogOut, PlusCircle, Radio, Settings, GraduationCap, Trash2, Shield } from 'lucide-react';
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
      className="h-screen bg-black/40 backdrop-blur-xl border-r border-white/10 flex flex-col overflow-hidden whitespace-nowrap fixed left-0 top-0 z-40"
    >
      {/* Brand Header */}
      <div className="p-6 flex items-center gap-3 border-b border-white/5">
        <div className="w-8 h-8 bg-emerald-600 rounded-full flex items-center justify-center flex-shrink-0">
          <Radio className="w-4 h-4 text-white" />
        </div>
        <span className="font-bold text-xl tracking-tight text-white">Signal</span>
      </div>

      {/* Course List (Top) */}
      {/* ADDED 'flex flex-col' to ensure vertical stacking */}
      <div className="flex-grow overflow-y-auto p-4 flex flex-col gap-2"> 
        <div className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2 px-2">
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
                ${isActive ? 'bg-white/10 text-white' : 'text-neutral-400 hover:bg-white/5 hover:text-neutral-200'}
              `}
            >
              <button
                onClick={() => onSelectCourse(course)}
                title={course.title}
                className="w-full text-left p-3"
              >
                <div className="flex justify-between items-start mb-1 gap-2">
                  <span className="font-medium truncate max-w-[140px]">{course.title}</span>
                  {percent > 0 && (
                    <span className={`text-xs font-bold ${grade >= 70 ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {grade}%
                    </span>
                  )}
                </div>

                <div className="h-1 w-full bg-neutral-700 rounded-full overflow-hidden mt-2">
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
                className="absolute right-2 top-2 text-neutral-500 hover:text-rose-300"
                title="Delete course"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          );
        })}

        {courses.length === 0 && (
          <div className="text-sm text-neutral-600 italic px-2">No courses yet.</div>
        )}
      </div>

      {/* New Course Button */}
      <div className="p-4 border-t border-white/5">
        <button 
          onClick={onNewCourse}
          className="w-full flex items-center gap-3 p-3 rounded-xl bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white transition group"
        >
          <PlusCircle className="w-5 h-5" />
          <span className="font-semibold">New Course</span>
        </button>
      </div>

      {user.role === "instructor" || user.role === "administrator" ? (
        <div className="px-4 pb-4">
          <a
            href={`/instructor?instructorId=${encodeURIComponent(user.username)}`}
            className="w-full flex items-center gap-3 p-3 rounded-xl text-neutral-400 hover:bg-white/5 hover:text-neutral-200 transition"
          >
            <GraduationCap className="w-5 h-5" />
            <span className="font-semibold">Instructor Studio</span>
          </a>
          {user.role === "administrator" ? (
            <a
              href="/admin"
              className="mt-2 w-full flex items-center gap-3 p-3 rounded-xl text-neutral-400 hover:bg-white/5 hover:text-neutral-200 transition"
            >
              <Shield className="w-5 h-5" />
              <span className="font-semibold">Admin</span>
            </a>
          ) : null}
        </div>
      ) : null}

      {/* User Profile (Bottom) */}
      <div className="p-4 bg-black/20 border-t border-white/5">
        <div className="flex items-center gap-3">
          {/* Clicking avatar opens profile too */}
          <button onClick={onEditProfile} className="w-10 h-10 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-white font-bold shadow-lg hover:scale-105 transition">
             {avatarSeed.substring(0,2).toUpperCase()}
          </button>
          <div className="flex-grow min-w-0">
            <button onClick={onEditProfile} className="text-left hover:underline">
               <div className="font-medium text-white truncate">{sidebarName}</div>
            </button>
            <div className="text-xs text-neutral-500 truncate max-w-[100px]">{user.aboutMe ? 'Customized' : 'Free Plan'}</div>
          </div>
          
          <div className="flex gap-1">
             <button onClick={onEditProfile} className="text-neutral-400 hover:text-white p-1 transition" title="Edit Profile">
               <Settings className="w-4 h-4" />
             </button>
             <button onClick={onLogout} className="text-neutral-400 hover:text-white p-1 transition" title="Logout">
               <LogOut className="w-4 h-4" />
             </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
