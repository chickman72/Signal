"use server";

import "dotenv/config";
import { BlobServiceClient } from "@azure/storage-blob";
import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { extractText, chunkText, getEmbeddings } from "../lib/ingest";
import { getSearchClient } from "../lib/search";
import { getDocumentsContainer } from "../lib/db";

const storageConnectionString = process.env.AZURE_STORAGE_CONNECTION_STRING?.trim();
const storageContainer = process.env.AZURE_STORAGE_CONTAINER?.trim() || "documents";

function getFilesFromFormData(formData: FormData): File[] {
  const files: File[] = [];
  const explicit = formData.getAll("files");
  for (const entry of explicit) {
    if (entry instanceof File && entry.size > 0) files.push(entry);
  }
  const legacy = formData.getAll("file");
  for (const entry of legacy) {
    if (entry instanceof File && entry.size > 0) files.push(entry);
  }
  if (files.length > 0) return files;

  for (const value of formData.values()) {
    if (value instanceof File && value.size > 0) files.push(value);
  }
  if (files.length > 0) return files;

  throw new Error("No file found in form data.");
}

async function uploadBlockBlob(
  blobServiceClient: BlobServiceClient,
  blobName: string,
  data: Buffer,
  contentType?: string,
) {
  const containerClient = blobServiceClient.getContainerClient(storageContainer);
  await containerClient.createIfNotExists();

  const blockBlob = containerClient.getBlockBlobClient(blobName);
  await blockBlob.uploadData(data, {
    blobHTTPHeaders: { blobContentType: contentType || "application/pdf" },
  });
}

export async function uploadCourseDocument(formData: FormData, courseId: string) {
  try {
    if (!courseId) throw new Error("courseId is required.");
    if (!storageConnectionString) {
      throw new Error("Missing AZURE_STORAGE_CONNECTION_STRING.");
    }
    if (!process.env.AZURE_SEARCH_ENDPOINT?.trim() || !process.env.AZURE_SEARCH_KEY?.trim()) {
      throw new Error("Missing AZURE_SEARCH_ENDPOINT or AZURE_SEARCH_KEY.");
    }

    const files = getFilesFromFormData(formData);
    const blobServiceClient = BlobServiceClient.fromConnectionString(storageConnectionString);
    const searchClient = getSearchClient();
    const container = await getDocumentsContainer();
    const results = [];

    for (const file of files) {
      const blobName = `${courseId}/${Date.now()}-${file.name}`;
      const fileBuffer = Buffer.from(await file.arrayBuffer());

      await uploadBlockBlob(blobServiceClient, blobName, fileBuffer, file.type);

      const text = await extractText(file);
      const chunks = chunkText(text);
      const documents = [];

      for (let i = 0; i < chunks.length; i += 1) {
        const chunk = chunks[i];
        const embedding = await getEmbeddings(chunk);
        documents.push({
          id: crypto.randomUUID(),
          content: chunk,
          embedding,
          courseId,
          sourcefile: file.name,
        });
      }

      const batchSize = 100;
      for (let i = 0; i < documents.length; i += batchSize) {
        const batch = documents.slice(i, i + batchSize);
        await searchClient.uploadDocuments(batch);
      }

      const metadata = {
        id: crypto.randomUUID(),
        courseId,
        filename: file.name,
        blobName,
        uploadedAt: new Date().toISOString(),
        status: "indexed",
        chunkCount: chunks.length,
      };
      await container.items.create(metadata);
      results.push(metadata);
    }

    revalidatePath("/instructor");
    revalidatePath(`/instructor/course/${courseId}`);
    return {
      ok: true,
      metadata: results[0],
      message: `Upload complete. ${results.length} file(s) indexed.`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed.";
    console.error("Document upload failed:", error);
    return { ok: false, message };
  }
}

export async function uploadCourseDocumentAction(
  _prevState: { ok: boolean; message?: string },
  formData: FormData,
) {
  const courseId = String(formData.get("courseId") || "").trim();
  if (!courseId) {
    return { ok: false, message: "Course ID is required." };
  }
  return uploadCourseDocument(formData, courseId);
}

function escapeFilterValue(value: string) {
  return value.replace(/'/g, "''");
}

async function deleteSearchDocuments(courseId: string, sourcefile: string) {
  const searchClient = getSearchClient();
  const filter = `courseId eq '${escapeFilterValue(courseId)}' and sourcefile eq '${escapeFilterValue(sourcefile)}'`;
  const ids: { id: string }[] = [];

  const searchResponse = await searchClient.search("*", {
    filter,
    select: ["id"],
    top: 1000,
  });

  const iterator = searchResponse.results;
  if (iterator && typeof iterator.byPage === "function") {
    for await (const page of iterator.byPage()) {
      for (const result of page.results) {
        const doc = result.document as { id?: string };
        if (doc.id) ids.push({ id: doc.id });
      }
    }
  } else if (iterator) {
    for await (const result of iterator as AsyncIterable<{ document: { id?: string } }>) {
      const doc = result.document;
      if (doc?.id) ids.push({ id: doc.id });
    }
  }

  const batchSize = 100;
  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    await searchClient.deleteDocuments(batch);
  }
}

export async function deleteCourseDocument(formData: FormData) {
  try {
    if (!storageConnectionString) {
      throw new Error("Missing AZURE_STORAGE_CONNECTION_STRING.");
    }
    const id = String(formData.get("id") || "").trim();
    let courseId = String(formData.get("courseId") || "").trim();
    const sourcefile = String(formData.get("sourcefile") || "").trim();
    const blobName = String(formData.get("blobName") || "").trim();

    if (!id || !sourcefile || !blobName) {
      throw new Error("Missing document metadata for deletion.");
    }

    let resolvedCourseId = courseId;
    if (!resolvedCourseId) {
      const container = await getDocumentsContainer();
      const { resources } = await container.items
          .query({
            query: "SELECT c.id, c.courseId FROM c WHERE c.id = @id",
            parameters: [{ name: "@id", value: id }],
          })
          .fetchAll();
      resolvedCourseId = resources[0]?.courseId ?? "";
    }

    await deleteCourseDocumentByMetadata({
      id,
      courseId: resolvedCourseId,
      sourcefile,
      blobName,
    });

    revalidatePath("/instructor");
    if (courseId) {
      revalidatePath(`/instructor/course/${courseId}`);
    }
    return { ok: true, message: "Document deleted." };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Delete failed.";
    console.error("Document delete failed:", error);
    return { ok: false, message };
  }
}

type DocumentMetadata = {
  id: string;
  courseId: string;
  sourcefile: string;
  blobName: string;
};

export async function deleteCourseDocumentByMetadata({
  id,
  courseId,
  sourcefile,
  blobName,
}: DocumentMetadata) {
  if (!storageConnectionString) {
    throw new Error("Missing AZURE_STORAGE_CONNECTION_STRING.");
  }
  if (!courseId) {
    throw new Error("courseId is required for document deletion.");
  }

  const blobServiceClient = BlobServiceClient.fromConnectionString(storageConnectionString);
  const containerClient = blobServiceClient.getContainerClient(storageContainer);
  await containerClient.getBlobClient(blobName).deleteIfExists();

  await deleteSearchDocuments(courseId, sourcefile);

  const container = await getDocumentsContainer();
  await container.item(id, courseId).delete();
}

export async function deleteCourseDocumentAction(
  _prevState: { ok: boolean; message?: string },
  formData: FormData,
) {
  return deleteCourseDocument(formData);
}
