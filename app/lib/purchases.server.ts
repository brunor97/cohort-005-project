import { and, eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "~/db/schema";
import { courses, enrollments, purchases } from "~/db/schema";
import { newEnrollmentNotification } from "~/lib/enrollments.server";
import type { Notification } from "~/lib/notifications.server";

// ─── Individual Purchases ───
// A Student buying a course for themselves: the Purchase, its Enrollment, and
// the Notifications it causes. The route sends those after the commit.
// Takes the database first, so tests can hand in an in-memory one.

type Db = BetterSQLite3Database<typeof schema>;

export type IndividualPurchaseResult = {
  purchase: typeof purchases.$inferSelect;
  enrollment: typeof enrollments.$inferSelect;
  notifications: Notification[];
};

/** Throws if the buyer is already enrolled or the course doesn't exist. */
export function makeIndividualPurchase(
  db: Db,
  userId: number,
  courseId: number,
  amountPaid: number,
  country: string | null
): IndividualPurchaseResult {
  return db.transaction((tx) => {
    const course = tx
      .select({ id: courses.id })
      .from(courses)
      .where(eq(courses.id, courseId))
      .get();
    if (!course) throw new Error("Course not found");

    const existing = tx
      .select({ id: enrollments.id })
      .from(enrollments)
      .where(
        and(eq(enrollments.userId, userId), eq(enrollments.courseId, courseId))
      )
      .get();
    if (existing) throw new Error("User is already enrolled in this course");

    const purchase = tx
      .insert(purchases)
      .values({ userId, courseId, amountPaid, country })
      .returning()
      .get();
    const enrollment = tx
      .insert(enrollments)
      .values({ userId, courseId })
      .returning()
      .get();

    return {
      purchase,
      enrollment,
      notifications: [newEnrollmentNotification(tx, enrollment)],
    };
  });
}
