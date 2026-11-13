import { eq } from "drizzle-orm";
import { comments, courses, lessons, modules, users, UserRole } from "~/db/schema";
import { MIN_COMMENT_LENGTH, MAX_COMMENT_LENGTH } from "~/lib/comments";
import { getUserSummary, type Db } from "~/lib/db.server";
import type { Notification } from "~/lib/notifications.server";

// ─── Lesson comments ───
// Posting, editing and soft-deleting comments on a lesson. Posting returns the
// Notifications it causes; the route sends them after the commit. Editing and
// deleting cause none.
//
// Every function takes the database first, so tests can hand in an in-memory
// one.

export type Comment = typeof comments.$inferSelect;

/** The course a lesson belongs to, with the lesson's title. */
export function getCourseForLesson(db: Db, lessonId: number) {
  return db
    .select({
      courseId: courses.id,
      courseTitle: courses.title,
      courseSlug: courses.slug,
      instructorId: courses.instructorId,
      lessonTitle: lessons.title,
    })
    .from(lessons)
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .innerJoin(courses, eq(modules.courseId, courses.id))
    .where(eq(lessons.id, lessonId))
    .get();
}

/** The comment author, with the role that decides whether they are staff. */
function getAuthor(db: Db, userId: number) {
  return db
    .select({
      id: users.id,
      name: users.name,
      role: users.role,
      avatarUrl: users.avatarUrl,
    })
    .from(users)
    .where(eq(users.id, userId))
    .get();
}

export function getCommentById(db: Db, commentId: number) {
  return db.select().from(comments).where(eq(comments.id, commentId)).get();
}

function assertValidBody(body: string) {
  const trimmed = body.trim();
  if (trimmed.length < MIN_COMMENT_LENGTH) {
    throw new Error("Comment cannot be empty");
  }
  if (trimmed.length > MAX_COMMENT_LENGTH) {
    throw new Error(
      `Comment must be ${MAX_COMMENT_LENGTH} characters or fewer`
    );
  }
  return trimmed;
}

export type PostCommentResult = {
  comment: Comment;
  notifications: Notification[];
};

/**
 * Posts a top-level comment (parentId null) or a one-level reply. Throws on a
 * user-correctable problem. Returns the Notifications to send after commit:
 * - top-level, from someone who isn't staff: new_question to the Instructor
 * - a reply: comment_reply to the parent comment's author
 */
export function postComment(
  db: Db,
  userId: number,
  lessonId: number,
  parentId: number | null,
  body: string
): PostCommentResult {
  const trimmed = assertValidBody(body);

  const course = getCourseForLesson(db, lessonId);
  if (!course) {
    throw new Error("Lesson not found");
  }

  const parent = parentId === null ? undefined : getCommentById(db, parentId);
  if (parentId !== null) {
    if (!parent) {
      throw new Error("Parent comment not found");
    }
    if (parent.lessonId !== lessonId) {
      throw new Error("Parent comment belongs to a different lesson");
    }
    if (parent.parentId !== null) {
      throw new Error("Replies can only be one level deep");
    }
  }

  const comment = db
    .insert(comments)
    .values({ userId, lessonId, parentId, body: trimmed })
    .returning()
    .get();

  const author = getAuthor(db, userId);
  const notifications: Notification[] = [];
  const link = `/courses/${course.courseSlug}/lessons/${lessonId}#comments`;

  if (author && !parent) {
    const isStaff =
      author.id === course.instructorId || author.role === UserRole.Admin;
    const instructor = getUserSummary(db, course.instructorId);
    if (!isStaff && instructor) {
      notifications.push({
        kind: "new_question",
        recipient: { id: instructor.id, name: instructor.name },
        actorId: author.id,
        actorAvatarUrl: author.avatarUrl,
        title: `${author.name} asked a question`,
        body: `${author.name} commented on "${course.lessonTitle}".`,
        link,
      });
    }
  }

  if (author && parent) {
    // A self-reply is returned too; sendNotifications drops it.
    const parentAuthor = getUserSummary(db, parent.userId);
    if (parentAuthor) {
      notifications.push({
        kind: "comment_reply",
        recipient: { id: parentAuthor.id, name: parentAuthor.name },
        actorId: author.id,
        actorAvatarUrl: author.avatarUrl,
        title: `${author.name} replied to your comment`,
        body: `${author.name} replied to your comment on "${course.lessonTitle}".`,
        link,
      });
    }
  }

  return { comment, notifications };
}

/** Edits your own comment. Causes no Notifications. */
export function editComment(
  db: Db,
  commentId: number,
  userId: number,
  body: string
): Comment {
  const trimmed = assertValidBody(body);

  const existing = getCommentById(db, commentId);
  if (!existing) {
    throw new Error("Comment not found");
  }
  if (existing.deletedAt !== null) {
    throw new Error("Comment has been deleted");
  }
  if (existing.userId !== userId) {
    throw new Error("You can only edit your own comments");
  }

  return db
    .update(comments)
    .set({ body: trimmed, editedAt: new Date().toISOString() })
    .where(eq(comments.id, commentId))
    .returning()
    .get();
}

/**
 * Soft-deletes a comment: its author or staff may. Causes no Notifications,
 * and Notifications already sent about it stay.
 */
export function deleteComment(
  db: Db,
  commentId: number,
  userId: number,
  isStaff: boolean
): Comment {
  const existing = getCommentById(db, commentId);
  if (!existing) {
    throw new Error("Comment not found");
  }
  if (existing.userId !== userId && !isStaff) {
    throw new Error("You can only delete your own comments");
  }
  if (existing.deletedAt !== null) {
    return existing;
  }

  return db
    .update(comments)
    .set({ deletedAt: new Date().toISOString() })
    .where(eq(comments.id, commentId))
    .returning()
    .get();
}
