'use server'

import { getUsersContainer, getCoursesContainer, getLogsContainer } from './lib/db';
import { User, Course, ActivityLogEntry, ActivityEventType } from './types';
import crypto from 'crypto';

// --- USER ACTIONS ---
export async function getOrCreateUser(username: string): Promise<User> {
  const container = await getUsersContainer();
  
  const { resources } = await container.items
    .query({
      query: "SELECT * FROM c WHERE c.username = @username",
      parameters: [{ name: "@username", value: username }]
    })
    .fetchAll();

  if (resources.length > 0) {
    return resources[0] as User;
  }

  // Create new user if not found
  const newUser: User = { 
    username, 
    aboutMe: "",
    id: username // Cosmos requires strict ID
  } as any; 
  
  await container.items.create(newUser);
  return newUser;
}

export async function updateUserProfile(username: string, aboutMe: string) {
  const container = await getUsersContainer();
  const user = await getOrCreateUser(username);
  const updated = { ...user, aboutMe };
  await container.item(user.username, user.username).replace(updated);
  return updated;
}

export async function loginUser(username: string): Promise<User> {
  const container = await getUsersContainer();
  const { resources } = await container.items
    .query({
      query: "SELECT * FROM c WHERE c.username = @username",
      parameters: [{ name: "@username", value: username }]
    })
    .fetchAll();

  if (resources.length === 0) {
    throw new Error('Account not found. Please create an account to continue.');
  }

  const user = resources[0] as User;
  await logEvent('login', { user: user.username });
  return user;
}

export async function signupUser(username: string, aboutMe: string = ''): Promise<User> {
  const container = await getUsersContainer();
  const trimmed = username.trim();
  if (!trimmed) throw new Error('Username is required.');

  const existing = await container.items
    .query({
      query: "SELECT * FROM c WHERE c.username = @username",
      parameters: [{ name: "@username", value: trimmed }]
    })
    .fetchAll();

  if (existing.resources.length > 0) {
    throw new Error('Username already exists. Please log in instead.');
  }

  const newUser: User = {
    id: trimmed,
    username: trimmed,
    aboutMe,
  } as any;

  await container.items.create(newUser);
  await logEvent('signup', { user: trimmed });
  return newUser;
}

// --- COURSE ACTIONS ---
export async function saveCourseToDb(course: Course, username: string) {
  const container = await getCoursesContainer();
  
  // Flatten for DB storage
  const courseItem = {
    ...course,
    id: course.course_id,
    username: username
  };
  
  await container.items.upsert(courseItem);
  await logEvent('generate_course', {
    user: username,
    courseId: course.course_id,
    response: { title: course.title, chapters: course.chapters?.length ?? 0 }
  });
}

export async function getUserCourses(username: string): Promise<Course[]> {
  const container = await getCoursesContainer();
  
  const { resources } = await container.items
    .query({
      query: "SELECT * FROM c WHERE c.username = @username",
      parameters: [{ name: "@username", value: username }]
    })
    .fetchAll();
    
  return resources as Course[];
}

// --- ACTIVITY LOGGING ---

export async function logEvent(eventType: ActivityEventType, entry: Partial<ActivityLogEntry>) {
  const container = await getLogsContainer();

  const logItem: ActivityLogEntry = {
    id: crypto.randomUUID(),
    user: entry.user ?? 'anonymous',
    eventType,
    timestamp: new Date().toISOString(),
    success: entry.success ?? true,
    ...entry,
  };

  await container.items.create(logItem);
  return logItem;
}
