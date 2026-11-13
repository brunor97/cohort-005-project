import { eq } from "drizzle-orm";
import { courses } from "~/db/schema";
import { getUserSummary, type Queryable } from "~/lib/db.server";
import type { Notification } from "~/lib/notifications.server";

// ─── Enrollment Notifications ───
// Server-only helpers about Enrollments. Every function takes the database
// first, so tests can hand in an in-memory one (or a transaction).

/**
 * The `new_enrollment` Notification telling a course's Instructor that a
 * Student has enrolled. It only needs the Enrollment, so it works however the
 * Enrollment came about: an Individual Purchase or a Claimed Seat.
 *
 * The Student is the actor, so an Instructor enrolling on their own course is
 * dropped by sendNotifications.
 */
export function newEnrollmentNotification(
  db: Queryable,
  enrollment: { userId: number; courseId: number }
): Notification {
  const course = db
    .select({
      id: courses.id,
      title: courses.title,
      instructorId: courses.instructorId,
    })
    .from(courses)
    .where(eq(courses.id, enrollment.courseId))
    .get();
  if (!course) throw new Error("Course not found");

  const instructor = getUserSummary(db, course.instructorId);
  const student = getUserSummary(db, enrollment.userId);
  if (!instructor || !student) throw new Error("User not found");

  return {
    kind: "new_enrollment",
    recipient: { id: instructor.id, name: instructor.name },
    actorId: student.id,
    actorAvatarUrl: student.avatarUrl,
    title: `${student.name} enrolled on ${course.title}`,
    body: `${student.name} is now a Student on "${course.title}".`,
    link: `/instructor/${course.id}/students`,
  };
}
