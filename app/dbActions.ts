'use server'

import { getUsersContainer, getCoursesContainer } from './lib/db';
import { User, Course } from './types';

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