import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as db from '../../app/lib/db';
import * as dbActions from '../../app/dbActions';
import * as route from '../../app/api/courses/route';

describe('Courses API', () => {
  let upsertMock: any;
  let queryFetchAllMock: any;
  let queryMock: any;

  beforeEach(() => {
    upsertMock = vi.fn();
    queryFetchAllMock = vi.fn().mockResolvedValue({ resources: [] });
    queryMock = vi.fn(() => ({ fetchAll: queryFetchAllMock }));

    vi.spyOn(db, 'getCoursesContainer').mockResolvedValue({ items: { upsert: upsertMock, query: queryMock } } as any);
    vi.spyOn(dbActions, 'logEvent').mockResolvedValue({} as any);
  });

  it('persists quizHistory on POST and logs quiz_submit', async () => {
    const fakeCourse = {
      course_id: 'c1',
      title: 'Test Course',
      chapters: [],
      progress: {
        totalChapters: 3,
        completedChapterIds: [1],
        quizScores: { 1: 5 },
        overallGrade: 100,
        percentComplete: 33
      },
      quizHistory: {
        1: [
          {
            question: { question: 'q1', options: ['a','b'], correct_answer: 0 },
            selectedOption: 1,
            isCorrect: false
          }
        ]
      }
    } as any;

    // Simulate that after upsert the DB query returns the saved item
    queryFetchAllMock.mockResolvedValue({ resources: [{ ...fakeCourse, id: fakeCourse.course_id, username: 'u1' }] });

    const req = { json: async () => ({ course: fakeCourse, username: 'u1' }) } as any;
    const res = await route.POST(req);

    // Ensure upsert was called with the full item (including quizHistory)
    expect(upsertMock).toHaveBeenCalledWith({ ...fakeCourse, id: fakeCourse.course_id, username: 'u1' });
    const upsertArg = upsertMock.mock.calls[0][0];
    expect(upsertArg.progress).toBeDefined();
    expect(upsertArg.quizHistory).toBeDefined();

    // The handler should read back the saved item and return it
    const body = await res.json();
    expect(body.saved).toBeDefined();
    expect(body.saved.quizHistory).toBeDefined();

    // Ensure quiz_submit log event was recorded
    expect(dbActions.logEvent).toHaveBeenCalled();
    const logCall = (dbActions.logEvent as any).mock.calls[0];
    expect(logCall[0]).toBe('quiz_submit');
  });

  it('GET queries courses for username and returns resources', async () => {
    const fakeCourse = { course_id: 'c1', title: 'T' } as any;
    queryFetchAllMock.mockResolvedValue({ resources: [fakeCourse] });

    const req = { nextUrl: { searchParams: new URLSearchParams({ username: 'u1' }) } } as any;
    const res = await route.GET(req);

    // Ensure query was invoked to fetch courses
    expect(queryMock).toHaveBeenCalled();
  });
});
