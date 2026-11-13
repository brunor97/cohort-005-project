import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Novu } from "@novu/api";

// ─── In-app Notifications ───
// Mirrors the mailer. Novu delivers every Notification when NOVU_SECRET_KEY is
// set. Without a key (local dev, tests) each one is written to
// .outbox/notifications as a JSON file instead. See docs/adr/0013.
//
// Domain functions build Notifications and return them; route actions pass
// them to sendNotifications after the database commit.

export type NotificationKind =
  | "refund_approved"
  | "refund_declined"
  | "refund_request_raised"
  | "seat_claimed"
  | "new_enrollment"
  | "new_question"
  | "comment_reply"
  | "course_status_changed";

export type Notification = {
  kind: NotificationKind;
  recipient: { id: number; name: string };
  /** Who caused it. Nobody is notified of their own action. */
  actorId: number;
  title: string;
  body: string;
  /** Where clicking it takes the recipient: an in-app path. */
  link: string;
  actorAvatarUrl?: string | null;
};

export interface NotificationTransport {
  send(notification: Notification): Promise<void>;
}

export function outboxNotificationTransport(
  directory: string
): NotificationTransport {
  return {
    async send(notification) {
      mkdirSync(directory, { recursive: true });
      const file = join(
        directory,
        `${Date.now()}-${notification.recipient.id}-${randomUUID()}.json`
      );
      writeFileSync(file, JSON.stringify(notification, null, 2));
    },
  };
}

/** The one Novu workflow every Notification goes through (docs/adr/0013). */
const NOVU_WORKFLOW_ID = "in-app-notification";

/**
 * Triggers the `in-app-notification` workflow, identifying the subscriber
 * inline: the Cadence user id as subscriberId, and their name as first name.
 * `serverURL` is only for pointing it somewhere else in tests.
 */
export function novuNotificationTransport(
  secretKey: string,
  serverURL?: string
): NotificationTransport {
  const novu = new Novu({
    secretKey,
    serverURL,
    retryConfig: { strategy: "none" },
  });

  return {
    async send(notification) {
      await novu.trigger({
        workflowId: NOVU_WORKFLOW_ID,
        to: {
          subscriberId: String(notification.recipient.id),
          firstName: notification.recipient.name,
        },
        payload: {
          kind: notification.kind,
          title: notification.title,
          body: notification.body,
          link: notification.link,
          actorAvatarUrl: notification.actorAvatarUrl ?? null,
        },
      });
    },
  };
}

/** Novu when NOVU_SECRET_KEY is set, otherwise the local outbox. */
export function defaultNotificationTransport(): NotificationTransport {
  const secretKey = process.env.NOVU_SECRET_KEY;
  return secretKey
    ? novuNotificationTransport(secretKey)
    : outboxNotificationTransport(join(".outbox", "notifications"));
}

/**
 * Sends each Notification on its own and never throws, so a provider outage
 * can't break the action that caused them. Call it after the database commit.
 *
 * - Drops any Notification whose recipient is its actor. This is the one place
 *   the no-self-notification rule is enforced.
 * - A failed send is logged with its recipient and title, and not retried.
 */
export async function sendNotifications(
  notifications: Notification[],
  transport: NotificationTransport = defaultNotificationTransport()
): Promise<void> {
  const toSend = notifications.filter(
    (notification) => notification.recipient.id !== notification.actorId
  );

  await Promise.all(
    toSend.map(async (notification) => {
      try {
        await transport.send(notification);
      } catch (error) {
        console.error(
          `Failed to send Notification "${notification.title}" to user ${notification.recipient.id}:`,
          error
        );
      }
    })
  );
}
