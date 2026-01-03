import { NextRequest, NextResponse } from 'next/server';
import { getCoursesContainer } from '../../lib/db';
import { logEvent } from '../../dbActions';

export async function GET(req: NextRequest) {
  const username = req.nextUrl.searchParams.get('username');
  if (!username) {
    return NextResponse.json({ error: 'username is required' }, { status: 400 });
  }

  try {
    const container = await getCoursesContainer();
    const { resources } = await container.items
      .query({
        query: "SELECT * FROM c WHERE c.username = @username",
        parameters: [{ name: "@username", value: username }]
      })
      .fetchAll();

    return NextResponse.json({ courses: resources ?? [] });
  } catch (error) {
    console.error('Failed to load courses', error);
    return NextResponse.json({ error: 'Failed to load courses' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { course, username } = body as { course: any; username: string };

    if (!course || !username) {
      return NextResponse.json({ error: 'course and username are required' }, { status: 400 });
    }

    const container = await getCoursesContainer();
    const item = { ...course, id: course.course_id, username };

    // Upsert without forcing a partitionKey — let the SDK use the item's partition value.
    const upsertResult = await container.items.upsert(item);

    // Log appropriately depending on whether this request included quiz history (i.e., a quiz submission)
    if (course.quizHistory && Object.keys(course.quizHistory).length > 0) {
      await logEvent('quiz_submit', {
        user: username,
        courseId: course.course_id,
        quizEntries: Object.keys(course.quizHistory).length
      });
    } else {
      await logEvent('generate_course', {
        user: username,
        courseId: course.course_id,
        response: { title: course.title, chapters: course.chapters?.length ?? 0 }
      });
    }

    // Read back the saved item to confirm quizHistory and progress were persisted
    const { resources: savedResources } = await container.items
      .query({
        query: "SELECT * FROM c WHERE c.course_id = @courseId",
        parameters: [{ name: "@courseId", value: course.course_id }]
      })
      .fetchAll();

    const saved = savedResources?.[0] ?? null;

    return NextResponse.json({ ok: true, saved });
  } catch (error) {
    console.error('Failed to save course', error);
    return NextResponse.json({ error: 'Failed to save course' }, { status: 500 });
  }
}
