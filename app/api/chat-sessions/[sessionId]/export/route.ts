import { NextRequest, NextResponse } from "next/server";
import { getChatSessionsContainer } from "../../../../lib/db";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await context.params;
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
  }

  try {
    const container = await getChatSessionsContainer();
    const { resource } = await container.item(sessionId, sessionId).read();
    if (!resource) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const messages = (resource.messages ?? []) as Array<{
      role?: string;
      content?: string;
      createdAt?: string;
    }>;

    const title = `Chat session ${sessionId.slice(0, 8)}`;
    const htmlBody = [`<h1>${title}</h1>`, `<p><strong>Course:</strong> ${resource.courseId}</p>`];

    if (resource.studentName) {
      htmlBody.push(`<p><strong>Student:</strong> ${resource.studentName}</p>`);
    }

    htmlBody.push("<hr />");

    htmlBody.push("<div style='font-family:Calibri,Arial,Helvetica,sans-serif;'>");
    for (const msg of messages) {
      const actor = msg.role === "assistant" ? "Tutor" : "Student";
      const time = msg.createdAt ? ` (${new Date(msg.createdAt).toLocaleString()})` : "";
      const content = (msg.content || "").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br />");
      htmlBody.push(
        `<p><strong>${actor}${time}:</strong><br />${content}</p><hr />`,
      );
    }
    htmlBody.push("</div>");

    const docName = `chat-session-${sessionId}.doc`;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8" /><title>${title}</title></head><body>${htmlBody.join("")}</body></html>`;

    return new NextResponse(html, {
      headers: {
        "Content-Type": "application/msword",
        "Content-Disposition": `attachment; filename="${docName}"`,
      },
    });
  } catch (error) {
    console.error("Failed to export chat session", error);
    return NextResponse.json({ error: "Failed to export chat session" }, { status: 500 });
  }
}
