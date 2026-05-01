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

const defaultSimulationPrompt = `You are a patient in a medical simulation.
Respond naturally as a patient would, expressing concerns, asking questions, and reacting to the healthcare provider's communication.
Stay in character and provide realistic patient responses based on the clinical scenario.`;

function getDefaultSystemPrompt(tutorMode: 'simulation' | 'course_tutor' = 'course_tutor') {
  return tutorMode === 'simulation' ? defaultSimulationPrompt : defaultSystemPrompt;
}

async function fetchCourse(id: string, instructorId: string) {
  const container = await getInstructorCoursesContainer();
  const { resource } = await container.item(id, instructorId).read();
  return resource as {
    id: string;
    title: string;
    description?: string;
    tutorMode: 'simulation' | 'course_tutor';
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
      <main className="min-h-screen bg-slate-50 text-slate-900">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12 lg:gap-10">
          <header className="flex flex-col gap-2">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-600">
              Instructor Studio
            </p>
            <a
              href={`/instructor/course/${encodeURIComponent(
                resolvedParams.id,
              )}?instructorId=${encodeURIComponent(instructorId)}`}
              className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-700 hover:text-cyan-700"
            >
              Back to Dashboard
            </a>
            <h1 className="text-2xl font-semibold text-slate-950 sm:text-3xl">
              {isNew ? "Create Course" : "Edit Settings"}
            </h1>
            <p className="text-sm text-slate-600">
              Configure the tutoring persona and build the knowledge base.
            </p>
          </header>

          <section id="tutor-persona">
            <CourseEditor
              initialCourse={{
                id: course?.id,
                title: course?.title ?? "",
                description: course?.description ?? "",
                tutorMode: course?.tutorMode ?? "course_tutor",
                systemPrompt: course?.systemPrompt ?? getDefaultSystemPrompt(course?.tutorMode ?? "course_tutor"),
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
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xl shadow-slate-200/80 sm:p-6"
          >
            <div className="flex flex-col gap-2">
              <h2 className="text-lg font-semibold text-slate-950">
                Knowledge Base
              </h2>
              <p className="text-sm text-slate-600">
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

            <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200">
              <div className="grid min-w-[680px] grid-cols-[1.4fr_0.7fr_0.6fr_0.5fr] gap-4 border-b border-slate-200 bg-white px-4 py-3 text-xs uppercase tracking-[0.2em] text-slate-500">
                <span>Filename</span>
                <span>Upload Date</span>
                <span>Status</span>
                <span>Actions</span>
              </div>
              {documents.length === 0 ? (
                <div className="px-4 py-8 text-sm text-slate-600">
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
                      className="grid min-w-[680px] grid-cols-[1.4fr_0.7fr_0.6fr_0.5fr] gap-4 border-b border-slate-200 px-4 py-4 text-sm text-slate-800 last:border-b-0"
                    >
                      <div className="flex flex-col gap-1">
                        <span className="font-medium text-slate-900">
                          {doc.filename ?? "Untitled"}
                        </span>
                      </div>
                      <span className="text-sm text-slate-700">{dateLabel}</span>
                      <span className="inline-flex w-fit items-center rounded-full border border-slate-300 bg-slate-50/60 px-3 py-1 text-xs uppercase tracking-wide text-cyan-700">
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
