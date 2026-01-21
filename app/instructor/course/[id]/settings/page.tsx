import CourseEditor from "../../CourseEditor";
import ShareLink from "../../ShareLink";
import UploadForm from "../../../UploadForm";
import DeleteButton from "../../../DeleteButton";
import { getDocumentsContainer, getInstructorCoursesContainer } from "../../../../lib/db";
import InstructorGuard from "../../../InstructorGuard";

type DocumentItem = {
  id: string;
  courseId?: string;
  filename?: string;
  blobName?: string;
  uploadedAt?: string;
  status?: string;
};

const defaultSystemPrompt = `You are Nurse Blaze, a confident nursing preceptor.
You use calm, reassuring language and ask probing questions to identify gaps.
You respond with short explanations and follow-up questions.
Always connect answers to clinical safety and best practices.`;

async function fetchCourse(id: string, instructorId: string) {
  const container = await getInstructorCoursesContainer();
  const { resource } = await container.item(id, instructorId).read();
  return resource as {
    id: string;
    title: string;
    systemPrompt: string;
    starterPrompts: string[];
    instructorId: string;
  } | undefined;
}

async function fetchDocumentsByCourse(courseId: string): Promise<DocumentItem[]> {
  const container = await getDocumentsContainer();
  const { resources } = await container.items
    .query({
      query: "SELECT * FROM c WHERE c.courseId = @courseId ORDER BY c.uploadedAt DESC",
      parameters: [{ name: "@courseId", value: courseId }],
    })
    .fetchAll();
  return resources as DocumentItem[];
}

export default async function CourseSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ instructorId?: string }>;
}) {
  const resolvedParams = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const instructorId = resolvedSearchParams?.instructorId ?? "default-instructor";
  const isNew = resolvedParams.id === "new";
  const course = isNew ? undefined : await fetchCourse(resolvedParams.id, instructorId);

  const courseId = course?.id;
  const documents = courseId ? await fetchDocumentsByCourse(courseId) : [];

  return (
    <InstructorGuard>
      <main className="min-h-screen bg-slate-950 text-slate-100">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 py-12">
          <header className="flex flex-col gap-2">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
              Instructor Studio
            </p>
            <a
              href={`/instructor/course/${encodeURIComponent(
                resolvedParams.id,
              )}?instructorId=${encodeURIComponent(instructorId)}`}
              className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-300 hover:text-cyan-200"
            >
              Back to Dashboard
            </a>
            <h1 className="text-3xl font-semibold text-slate-50">
              {isNew ? "Create Course" : "Edit Settings"}
            </h1>
            <p className="text-sm text-slate-400">
              Configure the tutoring persona and build the knowledge base.
            </p>
          </header>

          <section id="tutor-persona">
            <CourseEditor
              initialCourse={{
                id: course?.id,
                title: course?.title ?? "",
                systemPrompt: course?.systemPrompt ?? defaultSystemPrompt,
                starterPrompts: course?.starterPrompts ?? [
                  "Help, I'm panicking!",
                  "Quiz me on sepsis.",
                ],
                instructorId,
              }}
            />
          </section>

          {courseId ? <ShareLink courseId={courseId} /> : null}

          <section
            id="knowledge-base"
            className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl shadow-slate-950/40"
          >
            <div className="flex flex-col gap-2">
              <h2 className="text-lg font-semibold text-slate-50">
                Knowledge Base
              </h2>
              <p className="text-sm text-slate-400">
                Upload PDFs to make them searchable for this course.
              </p>
            </div>

            <div className="mt-4">
              <UploadForm courseId={courseId} />
              {!courseId ? (
                <p className="mt-3 text-xs text-slate-500">
                  Save the course details to lock uploads to this course, or
                  enter a course ID manually.
                </p>
              ) : null}
            </div>

            <div className="mt-6 overflow-hidden rounded-xl border border-slate-800">
              <div className="grid grid-cols-[1.4fr_0.7fr_0.6fr_0.5fr] gap-4 border-b border-slate-800 bg-slate-900 px-4 py-3 text-xs uppercase tracking-[0.2em] text-slate-500">
                <span>Filename</span>
                <span>Upload Date</span>
                <span>Status</span>
                <span>Actions</span>
              </div>
              {documents.length === 0 ? (
                <div className="px-4 py-8 text-sm text-slate-400">
                  No documents uploaded for this course yet.
                </div>
              ) : (
                documents.map((doc) => {
                  const dateLabel = doc.uploadedAt
                    ? new Date(doc.uploadedAt).toLocaleString()
                    : "Unknown";
                  return (
                    <div
                      key={doc.id}
                      className="grid grid-cols-[1.4fr_0.7fr_0.6fr_0.5fr] gap-4 border-b border-slate-800 px-4 py-4 text-sm text-slate-200 last:border-b-0"
                    >
                      <div className="flex flex-col gap-1">
                        <span className="font-medium text-slate-100">
                          {doc.filename ?? "Untitled"}
                        </span>
                      </div>
                      <span className="text-sm text-slate-300">{dateLabel}</span>
                      <span className="inline-flex w-fit items-center rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1 text-xs uppercase tracking-wide text-cyan-300">
                        {doc.status ?? "unknown"}
                      </span>
                      <DeleteButton
                        id={doc.id}
                        courseId={doc.courseId ?? courseId ?? ""}
                        sourcefile={doc.filename ?? ""}
                        blobName={doc.blobName ?? ""}
                      />
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>
      </main>
    </InstructorGuard>
  );
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
