import { NextRequest, NextResponse } from "next/server";
import { deleteUserCourseById } from "../../../dbActions";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> },
) {
  const resolvedParams = await params;
  const courseId = resolvedParams.courseId;
  const username = req.nextUrl.searchParams.get("username");
  if (!courseId || !username) {
    return NextResponse.json({ error: "courseId and username are required" }, { status: 400 });
  }

  try {
    const result = await deleteUserCourseById(courseId, username);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error("Failed to delete course", error);
    return NextResponse.json({ error: "Failed to delete course" }, { status: 500 });
  }
}
