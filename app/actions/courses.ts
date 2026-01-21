"use server";

import crypto from "crypto";
import { getInstructorCoursesContainer } from "../lib/db";
import type { InstructorCourse } from "../types";
import { getDocumentsContainer } from "../lib/db";
import { deleteCourseDocumentByMetadata } from "./documents";
import { revalidatePath } from "next/cache";

type CourseInput = {
  id?: string;
  title: string;
  systemPrompt: string;
  starterPrompts: string[];
  instructorId: string;
};

export async function saveCourseDetails(courseData: CourseInput) {
  if (!courseData.title || !courseData.systemPrompt || !courseData.instructorId) {
    throw new Error("title, systemPrompt, and instructorId are required.");
  }

  const container = await getInstructorCoursesContainer();
  const now = new Date().toISOString();
  const id = courseData.id ?? crypto.randomUUID();

  const record: InstructorCourse = {
    id,
    title: courseData.title,
    systemPrompt: courseData.systemPrompt,
    starterPrompts: courseData.starterPrompts ?? [],
    instructorId: courseData.instructorId,
    lastUpdated: now,
  };

  if (!courseData.id) {
    record.createdAt = now;
  } else {
    const { resource } = await container.item(id, courseData.instructorId).read();
    record.createdAt = resource?.createdAt ?? now;
  }

  await container.items.upsert(record);
  return id;
}

export async function getCourseDetails(courseId: string) {
  if (!courseId) throw new Error("courseId is required.");
  const container = await getInstructorCoursesContainer();
  const { resources } = await container.items
    .query({
      query: "SELECT * FROM c WHERE c.id = @id",
      parameters: [{ name: "@id", value: courseId }],
    })
    .fetchAll();
  return resources[0] as InstructorCourse | undefined;
}

export async function deleteCourseAndDocuments(courseId: string, instructorId: string) {
  if (!courseId || !instructorId) {
    throw new Error("courseId and instructorId are required.");
  }

  const documentsContainer = await getDocumentsContainer();
  const { resources } = await documentsContainer.items
    .query({
      query: "SELECT c.id, c.courseId, c.sourcefile, c.blobName FROM c WHERE c.courseId = @courseId",
      parameters: [{ name: "@courseId", value: courseId }],
    })
    .fetchAll();

  const docErrors: string[] = [];
  for (const doc of resources as Array<{
    id: string;
    courseId: string;
    sourcefile: string;
    blobName: string;
  }>) {
    try {
      await deleteCourseDocumentByMetadata({
        id: doc.id,
        courseId: doc.courseId,
        sourcefile: doc.sourcefile,
        blobName: doc.blobName,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Document delete failed.";
      docErrors.push(`${doc.id}:${message}`);
    }
  }

  const coursesContainer = await getInstructorCoursesContainer();
  await coursesContainer.item(courseId, instructorId).delete();

  revalidatePath("/instructor");
  revalidatePath(`/instructor/course/${courseId}`);
  if (docErrors.length) {
    console.warn("Course delete completed with document cleanup errors:", docErrors);
  }
  return { ok: true };
}

export async function deleteCourseAndDocumentsAction(
  _prevState: { ok: boolean; message?: string },
  formData: FormData,
) {
  try {
    const courseId = String(formData.get("courseId") || "").trim();
    const instructorId = String(formData.get("instructorId") || "").trim();
    await deleteCourseAndDocuments(courseId, instructorId);
    return { ok: true, message: "Course deleted." };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Delete failed.";
    return { ok: false, message };
  }
}
