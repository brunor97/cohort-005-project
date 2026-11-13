import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, seedBaseData } from "~/test/setup";
import * as schema from "~/db/schema";
import { RefundStatus, UserRole } from "~/db/schema";
import { approveRefundRequest, declineRefundRequest } from "./refunds.server";
import {
  sendNotifications,
  type Notification,
  type NotificationTransport,
} from "./notifications.server";

type TestDb = ReturnType<typeof createTestDb>;

const NOW = new Date(2026, 9, 6, 12, 0, 0);

let db: TestDb;
let courseId: number;
let platformAdmin: typeof schema.users.$inferSelect;
let buyer: typeof schema.users.$inferSelect;

beforeEach(() => {
  db = createTestDb();
  courseId = seedBaseData(db).course.id;
  platformAdmin = addUser("Test Admin", "admin@example.test", UserRole.Admin);
  buyer = addUser("Test Buyer", "buyer@example.test", UserRole.Student);
});

function addUser(name: string, email: string, role: UserRole) {
  return db
    .insert(schema.users)
    .values({ name, email, role })
    .returning()
    .get();
}

function raiseFor(purchaseId: number) {
  return db
    .insert(schema.refunds)
    .values({
      purchaseId,
      status: RefundStatus.Open,
      reason: "Not for me.",
      requestedAt: NOW.toISOString(),
    })
    .returning()
    .get().id;
}

/** An Individual Purchase by the buyer, with its Enrollment, and an Open Refund Request. */
function individualRefundRequest(buyerId = buyer.id) {
  const purchase = db
    .insert(schema.purchases)
    .values({ userId: buyerId, courseId, amountPaid: 7900 })
    .returning()
    .get();
  db.insert(schema.enrollments).values({ userId: buyerId, courseId }).run();
  return raiseFor(purchase.id);
}

/** A Team Licence of two Unclaimed Seats bought by the buyer, and an Open Refund Request. */
function teamLicenceRefundRequest() {
  const purchase = db
    .insert(schema.purchases)
    .values({ userId: buyer.id, courseId, amountPaid: 15800 })
    .returning()
    .get();
  const team = db.insert(schema.teams).values({}).returning().get();
  for (const code of ["SEAT-ONE", "SEAT-TWO"]) {
    db.insert(schema.coupons)
      .values({ teamId: team.id, courseId, code, purchaseId: purchase.id })
      .run();
  }
  return raiseFor(purchase.id);
}

function notificationsOf(result: ReturnType<typeof approveRefundRequest>) {
  if (!result.ok) throw new Error(result.error);
  return result.notifications;
}

describe("Notifications when a Refund Request is decided", () => {
  it("approving tells the buyer, linking an Individual Purchase to the settings page", () => {
    const id = individualRefundRequest();

    const notifications = notificationsOf(
      approveRefundRequest(db, id, platformAdmin.id, null, NOW)
    );

    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({
      kind: "refund_approved",
      recipient: { id: buyer.id, name: "Test Buyer" },
      actorId: platformAdmin.id,
      link: "/settings",
    });
  });

  it("approving a Team Licence links to the team page and says its Unclaimed Seats ended", () => {
    const id = teamLicenceRefundRequest();

    const [notification] = notificationsOf(
      approveRefundRequest(db, id, platformAdmin.id, null, NOW)
    );

    expect(notification.kind).toBe("refund_approved");
    expect(notification.recipient.id).toBe(buyer.id);
    expect(notification.link).toBe("/team");
    expect(notification.body).toContain("Unclaimed Seats");
    expect(notification.body).not.toContain("Enrollment");
  });

  it("approving an Individual Purchase says the Enrollment ended", () => {
    const id = individualRefundRequest();

    const [notification] = notificationsOf(
      approveRefundRequest(db, id, platformAdmin.id, null, NOW)
    );

    expect(notification.body).toContain("Enrollment");
    expect(notification.body).not.toContain("Unclaimed Seats");
  });

  it("declining tells the buyer, linking each kind of Purchase to where it lives", () => {
    const individual = notificationsOf(
      declineRefundRequest(
        db,
        individualRefundRequest(),
        platformAdmin.id,
        "Outside the window.",
        NOW
      )
    );
    const team = notificationsOf(
      declineRefundRequest(
        db,
        teamLicenceRefundRequest(),
        platformAdmin.id,
        "Outside the window.",
        NOW
      )
    );

    for (const [notifications, link] of [
      [individual, "/settings"],
      [team, "/team"],
    ] as const) {
      expect(notifications).toHaveLength(1);
      expect(notifications[0]).toMatchObject({
        kind: "refund_declined",
        recipient: { id: buyer.id },
        actorId: platformAdmin.id,
        link,
      });
    }
  });

  it("a Platform Admin deciding their own Refund Request receives nothing", async () => {
    const id = individualRefundRequest(platformAdmin.id);
    const sent: Notification[] = [];
    const transport: NotificationTransport = {
      async send(notification) {
        sent.push(notification);
      },
    };

    await sendNotifications(
      notificationsOf(
        approveRefundRequest(db, id, platformAdmin.id, null, NOW)
      ),
      transport
    );

    expect(sent).toEqual([]);
  });

  it("deciding still succeeds when the Notification provider is unreachable", async () => {
    const unreachable: NotificationTransport = {
      async send() {
        throw new Error("connect ECONNREFUSED");
      },
    };
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});

    const approved = approveRefundRequest(
      db,
      individualRefundRequest(),
      platformAdmin.id,
      null,
      NOW
    );
    const declined = declineRefundRequest(
      db,
      teamLicenceRefundRequest(),
      platformAdmin.id,
      "No.",
      NOW
    );

    await expect(
      sendNotifications(
        [...notificationsOf(approved), ...notificationsOf(declined)],
        unreachable
      )
    ).resolves.toBeUndefined();
    expect(approved.ok && declined.ok).toBe(true);
    quiet.mockRestore();
  });
});
