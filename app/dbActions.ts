'use server'

import { getUsersContainer, getCoursesContainer, getLogsContainer } from './lib/db';
import { User, Course, ActivityLogEntry, ActivityEventType } from './types';
import crypto from 'crypto';

function hashPassword(password: string, salt?: string) {
  const saltValue = salt ?? crypto.randomBytes(16).toString('hex');
  const hashed = crypto.scryptSync(password, saltValue, 64).toString('hex');
  return { hash: hashed, salt: saltValue };
}

function verifyPassword(password: string, hash: string, salt: string) {
  const { hash: derived } = hashPassword(password, salt);
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(derived, 'hex'));
}

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

  throw new Error('Account not found.');
}

export async function updateUserProfile(username: string, aboutMe: string) {
  const container = await getUsersContainer();
  const user = await getOrCreateUser(username);
  const updated = { ...user, aboutMe };
  await container.item(user.username, user.username).replace(updated);
  return updated;
}

export async function loginUser(username: string, password: string): Promise<User> {
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

  const user = resources[0] as User & { passwordHash?: string; passwordSalt?: string };
  if (!user.role) {
    const updated = {
      ...user,
      role: "student" as const,
      displayName: user.displayName ?? user.username,
    };
    await container.item(user.username, user.username).replace(updated as any);
    return updated;
  }
  if (!user.passwordHash || !user.passwordSalt) {
    const { hash, salt } = hashPassword(password);
    const updated = { ...user, passwordHash: hash, passwordSalt: salt };
    await container.item(user.username, user.username).replace(updated as any);
  } else if (!verifyPassword(password, user.passwordHash, user.passwordSalt)) {
    throw new Error('Invalid password.');
  }
  await logEvent('login', { user: user.username });
  return user;
}

export async function signupUser(
  username: string,
  aboutMe: string = '',
  role: 'student' | 'instructor' | 'administrator' = 'student',
  email?: string,
  password?: string,
): Promise<User> {
  const container = await getUsersContainer();
  const trimmed = username.trim();
  if (!trimmed) throw new Error('Username is required.');
  if (!email || !email.trim()) throw new Error('Email is required.');
  if (!password || password.length < 8) throw new Error('Password must be at least 8 characters.');

  const existing = await container.items
    .query({
      query: "SELECT * FROM c WHERE c.username = @username OR c.email = @email",
      parameters: [
        { name: "@username", value: trimmed },
        { name: "@email", value: email.trim().toLowerCase() },
      ]
    })
    .fetchAll();

  if (existing.resources.length > 0) {
    throw new Error('Username already exists. Please log in instead.');
  }

  const { hash, salt } = hashPassword(password);
  const newUser: User & { passwordHash: string; passwordSalt: string; email: string; createdAt: string } = {
    id: trimmed,
    username: trimmed,
    aboutMe,
    role,
    email: email.trim().toLowerCase(),
    passwordHash: hash,
    passwordSalt: salt,
    createdAt: new Date().toISOString(),
    displayName: trimmed,
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

export async function deleteUserCourse(courseId: string, username: string) {
  await deleteUserCourseById(courseId, username);
}

export async function deleteUserCourseById(courseId: string, username: string) {
  if (!courseId || !username) {
    throw new Error("courseId and username are required.");
  }
  const container = await getCoursesContainer();
  const { resources } = await container.items
    .query({
      query: "SELECT * FROM c WHERE c.course_id = @courseId OR c.id = @courseId",
      parameters: [{ name: "@courseId", value: courseId }],
    })
    .fetchAll();
  if (!resources.length) {
    return { ok: true, deleted: 0 };
  }

  const { resource: containerInfo } = await container.read();
  const pkPath = containerInfo?.partitionKey?.paths?.[0] ?? "/id";
  const pkField = pkPath.replace(/^\//, "");

  const getPartitionKeyValue = (record: any) => {
    if (!pkField) return undefined;
    const segments = pkField.split("/");
    let value = record;
    for (const segment of segments) {
      if (value && typeof value === "object" && segment in value) {
        value = value[segment];
      } else {
        return undefined;
      }
    }
    return value;
  };

  const attemptDelete = async (record: any) => {
    const itemId = record.id ?? record.course_id ?? courseId;
    const derivedKey = getPartitionKeyValue(record);
    const partitionKeys = [
      derivedKey,
      record.username,
      record.id,
      record.course_id,
      username,
    ].filter((value): value is string => Boolean(value));
    for (const key of partitionKeys) {
      try {
        await container.item(itemId, key).delete();
        return true;
      } catch (error) {
        const statusCode = (error as { statusCode?: number; code?: number }).statusCode ?? (error as { code?: number }).code;
        if (statusCode !== 404) throw error;
      }
    }
    return false;
  };

  await Promise.all(resources.map(attemptDelete));
  await logEvent("generate_course", {
    user: username,
    courseId,
    success: true,
    response: { action: "delete_course" },
  });
  return { ok: true, deleted: resources.length };
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
