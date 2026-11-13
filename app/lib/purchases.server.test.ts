import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb, seedBaseData } from "~/test/setup";
import * as schema from "~/db/schema";
import { makeIndividualPurchase } from "./purchases.server";
import { sendNotifications, type Notification } from "./notifications.server";

type TestDb = ReturnType<typeof createTestDb>;

let db: TestDb;
let base: ReturnType<typeof seedBaseData>;

beforeEach(() => {
  db = createTestDb();
  base = seedBaseData(db);
});

describe("an Individual Purchase", () => {
  it("enrolls the buyer and notifies the course's Instructor, linking to the students page", () => {
    const result = makeIndividualPurchase(db, base.user.id, base.course.id, 4900, "CH");

    expect(result.purchase).toMatchObject({
      userId: base.user.id,
      courseId: base.course.id,
      amountPaid: 4900,
      country: "CH",
    });
    expect(result.enrollment).toMatchObject({
      userId: base.user.id,
      courseId: base.course.id,
    });
    expect(
      result.notifications.map((n) => ({
        kind: n.kind,
        recipientId: n.recipient.id,
        actorId: n.actorId,
        link: n.link,
      }))
    ).toEqual([
      {
        kind: "new_enrollment",
        recipientId: base.instructor.id,
        actorId: base.user.id,
        link: `/instructor/${base.course.id}/students`,
      },
    ]);
  });

  it("sends nothing to an Instructor who buys their own course", async () => {
    const sent: Notification[] = [];

    const result = makeIndividualPurchase(db, base.instructor.id, base.course.id, 4900, null);
    await sendNotifications(result.notifications, {
      async send(notification) {
        sent.push(notification);
      },
    });

    expect(sent).toEqual([]);
  });

  it("refuses a buyer who is already enrolled, recording no second Purchase", () => {
    makeIndividualPurchase(db, base.user.id, base.course.id, 4900, null);

    expect(() =>
      makeIndividualPurchase(db, base.user.id, base.course.id, 4900, null)
    ).toThrow("already enrolled");
    expect(db.select().from(schema.purchases).all()).toHaveLength(1);
  });
});
