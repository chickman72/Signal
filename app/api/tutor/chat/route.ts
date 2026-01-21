import { NextResponse } from "next/server";
import { chatWithTutor } from "../../../actions/tutor";

type ChatRequest = {
  sessionId?: string;
  courseId?: string;
  message?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ChatRequest;
    const sessionId = String(body.sessionId ?? "").trim();
    const courseId = String(body.courseId ?? "").trim();
    const message = String(body.message ?? "").trim();

    if (!sessionId || !courseId || !message) {
      return NextResponse.json(
        { ok: false, error: "sessionId, courseId, and message are required." },
        { status: 400 },
      );
    }

    const result = await chatWithTutor(sessionId, message, courseId);
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, message: result.message });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Tutor chat failed.";
    console.error("Tutor chat API failed:", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
