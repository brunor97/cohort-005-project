import { eq } from "drizzle-orm";
import { courses, type CourseStatus } from "~/db/schema";
import { getUserSummary, type Db } from "~/lib/db.server";
import type { Notification } from "~/lib/notifications.server";

// ─── Courses ───
// A Platform Admin managing courses. Every function takes the database first,
// so tests can hand in an in-memory one. Domain functions return their
// Notifications; the route sends them after the commit.

type Course = typeof courses.$inferSelect;

export type ChangeCourseStatusResult =
  | { ok: true; course: Course; notifications: Notification[] }
  | { ok: false; status: 404; error: string };

/**
 * Sets a course's status and tells its Instructor, unless the course already
 * had that status. The caller has already checked that the actor is a
 * Platform Admin.
 */
export function changeCourseStatus(
  db: Db,
  courseId: number,
  status: CourseStatus,
  actorId: number,
  now: Date = new Date()
): ChangeCourseStatusResult {
  const before = db
    .select({ status: courses.status })
    .from(courses)
    .where(eq(courses.id, courseId))
    .get();

  const course = db
    .update(courses)
    .set({ status, updatedAt: now.toISOString() })
    .where(eq(courses.id, courseId))
    .returning()
    .get();

  if (!before || !course) {
    return { ok: false, status: 404, error: "Course not found." };
  }
  if (before.status === status) return { ok: true, course, notifications: [] };

  const instructor = getUserSummary(db, course.instructorId);
  const actor = getUserSummary(db, actorId);

  const notifications: Notification[] = instructor
    ? [
        {
          kind: "course_status_changed",
          recipient: { id: instructor.id, name: instructor.name },
          actorId,
          actorAvatarUrl: actor?.avatarUrl ?? null,
          title: `"${course.title}" is now ${status}`,
          body: `A Platform Admin changed the status of "${course.title}" to ${status}.`,
          link: `/instructor/${course.id}`,
        },
      ]
    : [];

  return { ok: true, course, notifications };
}
