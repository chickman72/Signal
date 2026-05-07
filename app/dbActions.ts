'use server'

import { getUsersContainer, getCoursesContainer, getLogsContainer } from './lib/db';
import { User, Course, ActivityLogEntry, ActivityEventType } from './types';
import { PartitionKeyBuilder, type PartitionKey, type PrimitivePartitionKeyValue } from '@azure/cosmos';
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

async function saveUserRecord(container: Awaited<ReturnType<typeof getUsersContainer>>, user: User & Record<string, any>) {
  const id = user.id ?? user.username ?? user.email;
  if (!id) {
    throw new Error("User record is missing an id.");
  }
  await container.items.upsert({ ...user, id });
  return { ...user, id } as User & Record<string, any>;
}

// --- USER ACTIONS ---
export async function getOrCreateUser(email: string): Promise<User> {
  const container = await getUsersContainer();
  const rawInput = email.trim();
  const normalizedEmail = rawInput.toLowerCase();
  if (!rawInput) {
    throw new Error('Email is required.');
  }
  const { resources } = await container.items
    .query({
      query: "SELECT * FROM c WHERE c.email = @email OR c.username = @email OR c.username = @username",
      parameters: [
        { name: "@email", value: normalizedEmail },
        { name: "@username", value: rawInput },
      ]
    })
    .fetchAll();

  if (resources.length > 0) {
    return resources[0] as User;
  }

  throw new Error('Account not found.');
}

export async function updateUserProfile(
  email: string,
  displayName: string,
  aboutMe: string,
) {
  const container = await getUsersContainer();
  const user = await getOrCreateUser(email);
  const trimmedDisplayName = displayName.trim();
  const updated = {
    ...user,
    id: (user as User & { id?: string }).id ?? user.username ?? email,
    aboutMe,
    displayName: trimmedDisplayName ? trimmedDisplayName : undefined,
  };
  return saveUserRecord(container, updated as User & Record<string, any>);
}

export async function loginUser(email: string, password: string): Promise<User> {
  const container = await getUsersContainer();
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) {
    throw new Error('Email is required.');
  }
  const { resources } = await container.items
    .query({
      query: "SELECT * FROM c WHERE c.email = @email OR c.username = @email",
      parameters: [{ name: "@email", value: normalizedEmail }]
    })
    .fetchAll();

  if (resources.length === 0) {
    throw new Error('Account not found. Please create an account to continue.');
  }

  const user = resources[0] as User & { passwordHash?: string; passwordSalt?: string };
  if (!user.role) {
    const updated = {
      ...user,
      id: user.id ?? user.username ?? user.email,
      role: "student" as const,
      displayName: user.displayName ?? (user.username !== user.email ? user.username : undefined),
    };
    return saveUserRecord(container, updated);
  }
  if (!user.passwordHash || !user.passwordSalt) {
    const { hash, salt } = hashPassword(password);
    const updated = { ...user, id: user.id ?? user.username ?? user.email, passwordHash: hash, passwordSalt: salt };
    await saveUserRecord(container, updated);
  } else if (!verifyPassword(password, user.passwordHash, user.passwordSalt)) {
    throw new Error('Invalid password.');
  }
  await logEvent('login', { user: user.username });
  return user;
}

export async function signupUser(
  email: string,
  password: string,
  displayName: string = '',
  aboutMe: string = '',
  role: 'student' | 'administrator' = 'student',
): Promise<User> {
  const container = await getUsersContainer();
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) throw new Error('Email is required.');
  if (!password || password.length < 8) throw new Error('Password must be at least 8 characters.');

  const existing = await container.items
    .query({
      query: "SELECT * FROM c WHERE c.email = @email OR c.username = @email",
      parameters: [
        { name: "@email", value: normalizedEmail },
      ]
    })
    .fetchAll();

  if (existing.resources.length > 0) {
    throw new Error('Email already exists. Please log in instead.');
  }

  const { hash, salt } = hashPassword(password);
  const trimmedDisplayName = displayName.trim();
  const newUser: User & { passwordHash: string; passwordSalt: string; email: string; createdAt: string } = {
    id: normalizedEmail,
    username: normalizedEmail,
    aboutMe,
    role,
    email: normalizedEmail,
    passwordHash: hash,
    passwordSalt: salt,
    createdAt: new Date().toISOString(),
    displayName: trimmedDisplayName || undefined,
  } as any;

  await container.items.create(newUser);
  await logEvent('signup', { user: newUser.username });
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
  type CourseRecord = Course & {
    id?: string;
    username?: string;
    [key: string]: unknown;
  };

  const container = await getCoursesContainer();
  const { resources } = await container.items
    .query({
      query: "SELECT * FROM c WHERE (c.course_id = @courseId OR c.id = @courseId) AND c.username = @username",
      parameters: [
        { name: "@courseId", value: courseId },
        { name: "@username", value: username },
      ],
    })
    .fetchAll();
  if (!resources.length) {
    return { ok: true, deleted: 0 };
  }
  const courseRecords = resources as CourseRecord[];

  const { resource: containerInfo } = await container.read();
  const pkPaths = containerInfo?.partitionKey?.paths?.length
    ? containerInfo.partitionKey.paths
    : ["/id"];

  const getPathValue = (record: CourseRecord, path: string) => {
    const normalizedPath = path.replace(/^\//, "");
    if (!normalizedPath) return undefined;
    const segments = normalizedPath.split("/");
    let value: unknown = record;
    for (const segment of segments) {
      if (value && typeof value === "object" && segment in value) {
        value = (value as Record<string, unknown>)[segment];
      } else {
        return undefined;
      }
    }
    return value;
  };

  const buildPartitionKeyValue = (record: CourseRecord): PartitionKey => {
    const builder = new PartitionKeyBuilder();
    for (const path of pkPaths) {
      const value = getPathValue(record, path);
      if (value === undefined) {
        builder.addNoneValue();
      } else if (value === null) {
        builder.addNullValue();
      } else if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        builder.addValue(value);
      } else {
        builder.addNoneValue();
      }
    }
    const values = [...builder.values] as PrimitivePartitionKeyValue[];
    return values.length === 1 ? values[0] : values;
  };

  const partitionKeyKey = (value: unknown) => JSON.stringify(value);

  const attemptDelete = async (record: CourseRecord) => {
    const itemId = record.id ?? record.course_id ?? courseId;
    const partitionKeys = [
      buildPartitionKeyValue(record),
      {},
      undefined,
      record.username,
      record.id,
      record.course_id,
      username,
    ];
    const uniquePartitionKeys = Array.from(
      new Map(partitionKeys.map((key) => [partitionKeyKey(key), key])).values(),
    );
    for (const key of uniquePartitionKeys) {
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

  const deleteResults = await Promise.all(courseRecords.map(attemptDelete));
  const deleted = deleteResults.filter(Boolean).length;
  if (deleted === 0) {
    throw new Error(`Course ${courseId} was found but could not be deleted.`);
  }

  await logEvent("generate_course", {
    user: username,
    courseId,
    success: true,
    response: { action: "delete_course" },
  });
  return { ok: true, deleted };
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
