import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "~/db/schema";
import { courses, users, type CourseStatus } from "~/db/schema";
import type { Notification } from "~/lib/notifications.server";

// ─── Courses ───
// A Platform Admin managing courses. Every function takes the database first,
// so tests can hand in an in-memory one. Uses positional parameters (project
// convention). Domain functions return their Notifications; the route sends
// them after the commit.

export type Db = BetterSQLite3Database<typeof schema>;

type Course = typeof courses.$inferSelect;

export type ChangeCourseStatusResult =
  | { ok: true; course: Course; notifications: Notification[] }
  | { ok: false; status: 404; error: string };

/**
 * Sets a course's status and tells its Instructor. The caller has already
 * checked that the actor is a Platform Admin.
 */
export function changeCourseStatus(
  db: Db,
  courseId: number,
  status: CourseStatus,
  actorId: number,
  now: Date = new Date()
): ChangeCourseStatusResult {
  const course = db
    .update(courses)
    .set({ status, updatedAt: now.toISOString() })
    .where(eq(courses.id, courseId))
    .returning()
    .get();

  if (!course) return { ok: false, status: 404, error: "Course not found." };

  const instructor = db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.id, course.instructorId))
    .get();

  const actor = db
    .select({ avatarUrl: users.avatarUrl })
    .from(users)
    .where(eq(users.id, actorId))
    .get();

  const notifications: Notification[] = instructor
    ? [
        {
          kind: "course_status_changed",
          recipient: instructor,
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
