import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, seedBaseData } from "~/test/setup";
import * as schema from "~/db/schema";
import { CourseStatus, UserRole } from "~/db/schema";
import { changeCourseStatus } from "./courses.server";
import { sendNotifications, type Notification } from "./notifications.server";

type TestDb = ReturnType<typeof createTestDb>;

let db: TestDb;
let base: ReturnType<typeof seedBaseData>;
let platformAdmin: typeof schema.users.$inferSelect;

beforeEach(() => {
  db = createTestDb();
  base = seedBaseData(db);
  platformAdmin = db
    .insert(schema.users)
    .values({
      name: "Test Admin",
      email: "admin@example.test",
      role: UserRole.Admin,
    })
    .returning()
    .get();
});

describe("a Platform Admin changing a course's status", () => {
  it("notifies the course's Instructor of the new status, linking to the instructor page", () => {
    const result = changeCourseStatus(
      db,
      base.course.id,
      CourseStatus.Archived,
      platformAdmin.id
    );

    if (!result.ok) throw new Error(result.error);
    expect(result.course.status).toBe(CourseStatus.Archived);
    expect(result.notifications).toHaveLength(1);
    const [notification] = result.notifications;
    expect(notification).toMatchObject({
      kind: "course_status_changed",
      recipient: { id: base.instructor.id },
      actorId: platformAdmin.id,
      link: `/instructor/${base.course.id}`,
    });
    expect(`${notification.title} ${notification.body}`).toMatch(/archived/i);
  });

  it("fails for a course that doesn't exist", () => {
    const result = changeCourseStatus(
      db,
      999_999,
      CourseStatus.Draft,
      platformAdmin.id
    );

    expect(result.ok).toBe(false);
  });

  it("sends nothing when the status is set to the one it already has", () => {
    changeCourseStatus(db, base.course.id, CourseStatus.Archived, platformAdmin.id);

    const result = changeCourseStatus(
      db,
      base.course.id,
      CourseStatus.Archived,
      platformAdmin.id
    );

    if (!result.ok) throw new Error(result.error);
    expect(result.course.status).toBe(CourseStatus.Archived);
    expect(result.notifications).toEqual([]);
  });

  it("sends nothing to an Instructor who is the Platform Admin changing it", async () => {
    const result = changeCourseStatus(
      db,
      base.course.id,
      CourseStatus.Archived,
      base.instructor.id
    );
    if (!result.ok) throw new Error(result.error);
    const sent: Notification[] = [];

    await sendNotifications(result.notifications, {
      async send(notification) {
        sent.push(notification);
      },
    });

    expect(sent).toEqual([]);
  });

  it("still changes the status when Novu is unreachable", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const result = changeCourseStatus(
      db,
      base.course.id,
      CourseStatus.Published,
      platformAdmin.id
    );
    if (!result.ok) throw new Error(result.error);

    await expect(
      sendNotifications(result.notifications, {
        async send() {
          throw new Error("connect ECONNREFUSED");
        },
      })
    ).resolves.toBeUndefined();
    expect(result.course.status).toBe(CourseStatus.Published);

    consoleError.mockRestore();
  });
});
