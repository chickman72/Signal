import { NextRequest, NextResponse } from 'next/server';
import { getInstructorCoursesContainer } from '../../../lib/db';

export async function GET(req: NextRequest) {
  const instructorId = req.nextUrl.searchParams.get('instructorId');
  if (!instructorId) {
    return NextResponse.json({ error: 'instructorId is required' }, { status: 400 });
  }

  try {
    const container = await getInstructorCoursesContainer();
    const { resources } = await container.items
      .query({
        query: "SELECT * FROM c WHERE c.instructorId = @instructorId ORDER BY c.lastUpdated DESC",
        parameters: [{ name: "@instructorId", value: instructorId }],
      })
      .fetchAll();

    return NextResponse.json({ courses: resources ?? [] });
  } catch (error) {
    console.error('Failed to load instructor courses', error);
    return NextResponse.json({ error: 'Failed to load courses' }, { status: 500 });
  }
}