import { NextRequest, NextResponse } from "next/server";
import { getChatSessionsContainer } from "../../../lib/db";

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await context.params;
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
  }

  try {
    const container = await getChatSessionsContainer();
    await container.item(sessionId, sessionId).delete();
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to delete chat session", error);
    return NextResponse.json({ error: "Failed to delete chat session" }, { status: 500 });
  }
}
