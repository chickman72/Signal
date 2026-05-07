import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as db from '../../app/lib/db';
import * as dbActions from '../../app/dbActions';
import * as route from '../../app/api/courses/route';

describe('Courses API', () => {
  let upsertMock: any;
  let queryFetchAllMock: any;
  let queryMock: any;

  beforeEach(() => {
    vi.restoreAllMocks();
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

  it('deletes courses with hierarchical partition keys', async () => {
    const deleteMock = vi.fn().mockResolvedValue({});
    const itemMock = vi.fn(() => ({ delete: deleteMock }));
    queryFetchAllMock.mockResolvedValue({
      resources: [{ id: 'c1', course_id: 'c1', username: 'u1', title: 'T' }],
    });

    vi.spyOn(db, 'getCoursesContainer').mockResolvedValue({
      items: { query: queryMock },
      read: vi.fn().mockResolvedValue({
        resource: { partitionKey: { paths: ['/username', '/course_id'] } },
      }),
      item: itemMock,
    } as any);
    vi.spyOn(db, 'getLogsContainer').mockResolvedValue({
      items: { create: vi.fn().mockResolvedValue({}) },
    } as any);

    const result = await dbActions.deleteUserCourseById('c1', 'u1');

    expect(itemMock).toHaveBeenCalledWith('c1', ['u1', 'c1']);
    expect(deleteMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ ok: true, deleted: 1 });
  });

  it('deletes preexisting courses with missing partition key values', async () => {
    const deleteMock = vi
      .fn()
      .mockRejectedValueOnce({ statusCode: 404 })
      .mockResolvedValueOnce({});
    const itemMock = vi.fn(() => ({ delete: deleteMock }));
    queryFetchAllMock.mockResolvedValue({
      resources: [{ id: 'c1', course_id: 'c1', username: 'u1', title: 'T' }],
    });

    vi.spyOn(db, 'getCoursesContainer').mockResolvedValue({
      items: { query: queryMock },
      read: vi.fn().mockResolvedValue({
        resource: { partitionKey: { paths: ['/legacyPartition'] } },
      }),
      item: itemMock,
    } as any);
    vi.spyOn(db, 'getLogsContainer').mockResolvedValue({
      items: { create: vi.fn().mockResolvedValue({}) },
    } as any);

    const result = await dbActions.deleteUserCourseById('c1', 'u1');

    expect(itemMock).toHaveBeenNthCalledWith(1, 'c1', {});
    expect(itemMock).toHaveBeenNthCalledWith(2, 'c1', undefined);
    expect(result).toEqual({ ok: true, deleted: 1 });
  });

  it('fails deletion when matching courses are found but no item is removed', async () => {
    const notFoundError = { statusCode: 404 };
    const deleteMock = vi.fn().mockRejectedValue(notFoundError);
    const itemMock = vi.fn(() => ({ delete: deleteMock }));
    queryFetchAllMock.mockResolvedValue({
      resources: [{ id: 'c1', course_id: 'c1', username: 'u1', title: 'T' }],
    });

    vi.spyOn(db, 'getCoursesContainer').mockResolvedValue({
      items: { query: queryMock },
      read: vi.fn().mockResolvedValue({
        resource: { partitionKey: { paths: ['/username'] } },
      }),
      item: itemMock,
    } as any);

    await expect(dbActions.deleteUserCourseById('c1', 'u1')).rejects.toThrow(
      'Course c1 was found but could not be deleted.',
    );
  });
});
