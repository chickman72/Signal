"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { uploadCourseDocumentAction } from "../actions/documents";

type UploadState = {
  ok: boolean;
  message?: string;
};

const initialState: UploadState = { ok: true };

type UploadFormProps = {
  courseId?: string;
};

export default function UploadForm({ courseId }: UploadFormProps) {
  const router = useRouter();
  const lastMessageRef = useRef<string | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [state, formAction] = useActionState(uploadCourseDocumentAction, initialState);

  useEffect(() => {
    if (state.ok && state.message && state.message !== lastMessageRef.current) {
      lastMessageRef.current = state.message;
      setSelectedFiles([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      router.refresh();
    }
  }, [state.message, state.ok, router]);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const next = Array.from(files).filter((file) => file.size > 0);
    setSelectedFiles(next);
  };

  return (
    <form
      className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center"
      action={formAction}
    >
      {courseId ? (
        <input name="courseId" type="hidden" value={courseId} />
      ) : (
        <input
          name="courseId"
          placeholder="Course ID"
          className="w-full rounded-lg border border-slate-300 bg-slate-50/60 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 sm:max-w-xs"
        />
      )}
      <div className="flex-1">
        <label
          htmlFor="knowledge-files"
          onDragEnter={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragOver={(event) => {
            event.preventDefault();
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragging(false);
            handleFiles(event.dataTransfer.files);
            if (fileInputRef.current) {
              fileInputRef.current.files = event.dataTransfer.files;
            }
          }}
          className={`flex w-full cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-4 py-4 text-center text-sm text-slate-700 transition ${
            isDragging
              ? "border-cyan-400 bg-cyan-500/10 text-cyan-700"
              : "border-slate-300 bg-slate-50/40 hover:border-cyan-500/60"
          }`}
        >
          <span className="font-semibold text-slate-900">
            Drag & drop PDFs, DOCX, or PPTX here
          </span>
          <span className="text-xs text-slate-500">
            or click to browse (multiple files supported)
          </span>
          <input
            ref={fileInputRef}
            id="knowledge-files"
            name="files"
            type="file"
            accept="application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,.pdf,.docx,.pptx"
            multiple
            onChange={(event) => handleFiles(event.target.files)}
            className="hidden"
            required={selectedFiles.length === 0}
          />
        </label>
        {selectedFiles.length > 0 ? (
          <div className="mt-2 text-xs text-slate-600">
            {selectedFiles.map((file) => file.name).join(", ")}
          </div>
        ) : null}
      </div>
      <button
        type="submit"
        className="w-full rounded-lg bg-cyan-400 px-5 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 sm:w-auto"
      >
        Upload
      </button>
      {state.message ? (
        <span
          className={`text-sm ${state.ok ? "text-emerald-700" : "text-rose-700"}`}
        >
          {state.message}
        </span>
      ) : null}
    </form>
  );
}
