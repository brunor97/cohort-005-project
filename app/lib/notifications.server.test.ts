import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  novuNotificationTransport,
  outboxNotificationTransport,
  sendNotifications,
  type Notification,
  type NotificationTransport,
} from "./notifications.server";

function recordingTransport(failFor: number[] = []) {
  const sent: Notification[] = [];
  const transport: NotificationTransport = {
    async send(notification) {
      if (failFor.includes(notification.recipient.id)) {
        throw new Error("Novu is down");
      }
      sent.push(notification);
    },
  };
  return { sent, transport };
}

function notification(overrides: Partial<Notification> = {}): Notification {
  return {
    kind: "refund_request_raised",
    recipient: { id: 1, name: "Pat Admin" },
    actorId: 2,
    title: "A refund request was raised",
    body: "Liam asked for a refund.",
    link: "/admin/refunds",
    ...overrides,
  };
}

describe("the outbox transport", () => {
  it("writes one JSON file per Notification", async () => {
    const directory = mkdtempSync(join(tmpdir(), "notifications-"));

    await sendNotifications(
      [
        notification({ recipient: { id: 1, name: "Pat" } }),
        notification({ recipient: { id: 3, name: "Sam" } }),
      ],
      outboxNotificationTransport(directory)
    );

    const files = readdirSync(directory);
    expect(files).toHaveLength(2);
    const written = files.map((file) =>
      JSON.parse(readFileSync(join(directory, file), "utf8"))
    );
    expect(written.map((n) => n.recipient.id).sort()).toEqual([1, 3]);
    expect(written[0]).toMatchObject({
      kind: "refund_request_raised",
      link: "/admin/refunds",
    });
  });
});

describe("sendNotifications", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("drops a Notification whose recipient is its actor", async () => {
    const { sent, transport } = recordingTransport();

    await sendNotifications(
      [
        notification({ recipient: { id: 1, name: "Pat" }, actorId: 1 }),
        notification({ recipient: { id: 3, name: "Sam" }, actorId: 1 }),
      ],
      transport
    );

    expect(sent.map((n) => n.recipient.id)).toEqual([3]);
  });

  it("keeps sending the others when one fails, never rejects, and logs the failure", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { sent, transport } = recordingTransport([3]);

    await expect(
      sendNotifications(
        [
          notification({ recipient: { id: 1, name: "Pat" } }),
          notification({
            recipient: { id: 3, name: "Sam" },
            title: "Sam's refund request",
          }),
          notification({ recipient: { id: 4, name: "Kim" } }),
        ],
        transport
      )
    ).resolves.toBeUndefined();

    expect(sent.map((n) => n.recipient.id)).toEqual([1, 4]);
    expect(log).toHaveBeenCalledTimes(1);
    const logged = log.mock.calls[0].map(String).join(" ");
    expect(logged).toContain("3");
    expect(logged).toContain("Sam's refund request");
  });

  it("resolves when Novu is unreachable", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      sendNotifications(
        [notification()],
        novuNotificationTransport("test-secret-key", "http://127.0.0.1:9")
      )
    ).resolves.toBeUndefined();

    expect(log).toHaveBeenCalledTimes(1);
  });
});
