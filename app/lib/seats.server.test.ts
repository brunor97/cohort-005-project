import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb, seedBaseData } from "~/test/setup";
import * as schema from "~/db/schema";
import {
  claimSeat,
  SEAT_ALREADY_CLAIMED,
  SEAT_REFUNDED,
  SEAT_WRONG_COUNTRY,
} from "./seats.server";
import { sendNotifications, type Notification } from "./notifications.server";

type TestDb = ReturnType<typeof createTestDb>;

let db: TestDb;
let base: ReturnType<typeof seedBaseData>;
let teamAdmin: typeof schema.users.$inferSelect;

const SEAT_CODE = "TEST-SEAT-0001";

function createTeamLicence(adminId: number, country: string | null = null) {
  const team = db.insert(schema.teams).values({}).returning().get();
  db.insert(schema.teamMembers)
    .values({ teamId: team.id, userId: adminId, role: schema.TeamMemberRole.Admin })
    .run();
  const purchase = db
    .insert(schema.purchases)
    .values({ userId: adminId, courseId: base.course.id, amountPaid: 9800, country })
    .returning()
    .get();
  return db
    .insert(schema.coupons)
    .values({
      teamId: team.id,
      courseId: base.course.id,
      code: SEAT_CODE,
      purchaseId: purchase.id,
    })
    .returning()
    .get();
}

async function sent(notifications: Notification[]) {
  const out: Notification[] = [];
  await sendNotifications(notifications, {
    async send(notification) {
      out.push(notification);
    },
  });
  return out.map((n) => n.kind);
}

beforeEach(() => {
  db = createTestDb();
  base = seedBaseData(db);
  teamAdmin = db
    .insert(schema.users)
    .values({
      name: "Test Team Admin",
      email: "admin@example.test",
      role: schema.UserRole.Student,
    })
    .returning()
    .get();
});

describe("claiming a Seat", () => {
  it("enrolls the claimant and notifies the Team Admin and the Instructor", () => {
    createTeamLicence(teamAdmin.id);

    const result = claimSeat(db, { code: SEAT_CODE, userId: base.user.id, country: "" });

    if (!result.ok) throw new Error(result.error);
    expect(result.seat.redeemedByUserId).toBe(base.user.id);
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
      { kind: "seat_claimed", recipientId: teamAdmin.id, actorId: base.user.id, link: "/team" },
      {
        kind: "new_enrollment",
        recipientId: base.instructor.id,
        actorId: base.user.id,
        link: `/instructor/${base.course.id}/students`,
      },
    ]);
  });

  it("sends no seat_claimed to a Team Admin claiming their own Seat", async () => {
    createTeamLicence(teamAdmin.id);

    const result = claimSeat(db, { code: SEAT_CODE, userId: teamAdmin.id, country: "" });

    if (!result.ok) throw new Error(result.error);
    expect(await sent(result.notifications)).toEqual(["new_enrollment"]);
  });

  it("sends no new_enrollment to an Instructor claiming a Seat on their own course", async () => {
    createTeamLicence(teamAdmin.id);

    const result = claimSeat(db, { code: SEAT_CODE, userId: base.instructor.id, country: "" });

    if (!result.ok) throw new Error(result.error);
    expect(await sent(result.notifications)).toEqual(["seat_claimed"]);
  });

  it("refuses a Seat that has already been claimed", () => {
    createTeamLicence(teamAdmin.id);
    claimSeat(db, { code: SEAT_CODE, userId: base.user.id, country: "" });

    const result = claimSeat(db, { code: SEAT_CODE, userId: teamAdmin.id, country: "" });

    expect(result).toEqual({ ok: false, error: SEAT_ALREADY_CLAIMED });
  });

  it("refuses a Seat whose Team Licence has been refunded", () => {
    const seat = createTeamLicence(teamAdmin.id);
    db.update(schema.coupons)
      .set({ refundedAt: new Date().toISOString() })
      .where(eq(schema.coupons.id, seat.id))
      .run();

    const result = claimSeat(db, { code: SEAT_CODE, userId: base.user.id, country: "" });

    expect(result).toEqual({ ok: false, error: SEAT_REFUNDED });
  });

  it("refuses a claim from outside the purchaser's country", () => {
    createTeamLicence(teamAdmin.id, "CH");

    const result = claimSeat(db, { code: SEAT_CODE, userId: base.user.id, country: "FR" });

    expect(result).toEqual({ ok: false, error: SEAT_WRONG_COUNTRY });
  });
});
