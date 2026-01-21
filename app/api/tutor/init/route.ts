import { NextResponse } from "next/server";
import { initializeTutorSession } from "../../../actions/tutor";

type InitRequest = {
  courseId?: string;
  studentName?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as InitRequest;
    const courseId = String(body.courseId ?? "").trim();
    const studentName = body.studentName?.trim() || undefined;

    if (!courseId) {
      return NextResponse.json(
        { ok: false, error: "courseId is required." },
        { status: 400 },
      );
    }

    const result = await initializeTutorSession(courseId, studentName);
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      sessionId: result.sessionId,
      initialMessage: result.initialMessage,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to initialize session.";
    console.error("Tutor init API failed:", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
