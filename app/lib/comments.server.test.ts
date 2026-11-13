import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb, seedBaseData } from "~/test/setup";
import * as schema from "~/db/schema";
import { deleteComment, editComment, postComment } from "./comments.server";
import { sendNotifications, type Notification } from "./notifications.server";

type TestDb = ReturnType<typeof createTestDb>;

let db: TestDb;
let base: ReturnType<typeof seedBaseData>;
let lessonId: number;
let threadLink: string;

beforeEach(() => {
  db = createTestDb();
  base = seedBaseData(db);

  const module = db
    .insert(schema.modules)
    .values({ courseId: base.course.id, title: "Basics", position: 1 })
    .returning()
    .get();
  lessonId = db
    .insert(schema.lessons)
    .values({ moduleId: module.id, title: "Lesson 1", position: 1 })
    .returning()
    .get().id;
  threadLink = `/courses/${base.course.slug}/lessons/${lessonId}#comments`;
});

function summarise(notifications: Notification[]) {
  return notifications.map((n) => ({
    kind: n.kind,
    recipientId: n.recipient.id,
    actorId: n.actorId,
    link: n.link,
  }));
}

describe("Notifications when a comment is posted", () => {
  it("a Student's top-level comment sends new_question to the Instructor, linking to the lesson thread", () => {
    const result = postComment(db, base.user.id, lessonId, null, "How does this work?");

    expect(summarise(result.notifications)).toEqual([
      {
        kind: "new_question",
        recipientId: base.instructor.id,
        actorId: base.user.id,
        link: threadLink,
      },
    ]);
  });

  it("a top-level comment from staff sends nothing", () => {
    const platformAdmin = db
      .insert(schema.users)
      .values({
        name: "Test Admin",
        email: "admin@example.test",
        role: schema.UserRole.Admin,
      })
      .returning()
      .get();

    const fromInstructor = postComment(db, base.instructor.id, lessonId, null, "Welcome!");
    const fromAdmin = postComment(db, platformAdmin.id, lessonId, null, "Hello all.");

    expect(fromInstructor.notifications).toEqual([]);
    expect(fromAdmin.notifications).toEqual([]);
  });

  it("a reply sends comment_reply to the parent's author, linking to the lesson thread", () => {
    const question = postComment(db, base.user.id, lessonId, null, "How?");

    const reply = postComment(db, base.instructor.id, lessonId, question.comment.id, "Like this.");

    expect(summarise(reply.notifications)).toEqual([
      {
        kind: "comment_reply",
        recipientId: base.user.id,
        actorId: base.instructor.id,
        link: threadLink,
      },
    ]);
  });

  it("replying to your own comment sends nothing", async () => {
    const question = postComment(db, base.user.id, lessonId, null, "How?");
    const sent: Notification[] = [];

    const reply = postComment(db, base.user.id, lessonId, question.comment.id, "Never mind.");
    await sendNotifications(reply.notifications, {
      async send(notification) {
        sent.push(notification);
      },
    });

    expect(sent).toEqual([]);
  });

  it("still allows replies only one level deep", () => {
    const question = postComment(db, base.user.id, lessonId, null, "How?");
    const reply = postComment(db, base.instructor.id, lessonId, question.comment.id, "Like this.");

    expect(() =>
      postComment(db, base.user.id, lessonId, reply.comment.id, "Thanks!")
    ).toThrow("Replies can only be one level deep");
  });
});

describe("editing and deleting a comment", () => {
  it("returns no Notifications", () => {
    const question = postComment(db, base.user.id, lessonId, null, "How?");
    const reply = postComment(db, base.instructor.id, lessonId, question.comment.id, "Like this.");

    const edited = editComment(db, reply.comment.id, base.instructor.id, "Like this, see?");
    const deleted = deleteComment(db, question.comment.id, base.user.id, false);

    expect(edited).not.toHaveProperty("notifications");
    expect(deleted).not.toHaveProperty("notifications");
    expect(edited.body).toBe("Like this, see?");
    expect(deleted.deletedAt).not.toBeNull();
  });
});
