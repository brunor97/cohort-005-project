import { and, eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "~/db/schema";
import {
  coupons,
  enrollments,
  purchases,
  teamMembers,
  TeamMemberRole,
  users,
} from "~/db/schema";
import { newEnrollmentNotification } from "~/lib/enrollments.server";
import { getSeatAvailability } from "~/lib/refunds.server";
import type { Notification } from "~/lib/notifications.server";

// ─── Claiming Seats ───
// A Student claiming a Seat on a Team Licence: the Claimed Seat, its
// Enrollment, and the Notifications it causes. The route sends those after
// the commit. Takes the database first, so tests can hand in an in-memory one.

type Db = BetterSQLite3Database<typeof schema>;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

export const SEAT_ON_HOLD =
  "This seat can't be claimed right now. Ask the person who shared it with you.";
export const SEAT_REFUNDED =
  "This seat is no longer available. Ask the person who shared it with you.";

export type ClaimSeatResult =
  | {
      ok: true;
      seat: typeof coupons.$inferSelect;
      enrollment: typeof enrollments.$inferSelect;
      notifications: Notification[];
    }
  | { ok: false; error: string };

export function claimSeat(
  db: Db,
  { code, userId, country }: { code: string; userId: number; country: string }
): ClaimSeatResult {
  return db.transaction((tx): ClaimSeatResult => {
    const coupon = tx.select().from(coupons).where(eq(coupons.code, code)).get();
    if (!coupon) {
      return { ok: false, error: "Coupon not found" };
    }

    if (coupon.redeemedByUserId !== null) {
      return { ok: false, error: "Coupon has already been redeemed" };
    }

    const availability = getSeatAvailability(tx, coupon);
    if (availability === "on_hold") {
      return { ok: false, error: SEAT_ON_HOLD };
    }
    if (availability === "refunded") {
      return { ok: false, error: SEAT_REFUNDED };
    }

    const existingEnrollment = tx
      .select({ id: enrollments.id })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.userId, userId),
          eq(enrollments.courseId, coupon.courseId)
        )
      )
      .get();
    if (existingEnrollment) {
      return { ok: false, error: "You are already enrolled in this course" };
    }

    const purchase = tx
      .select({ country: purchases.country })
      .from(purchases)
      .where(eq(purchases.id, coupon.purchaseId))
      .get();
    if (purchase?.country && purchase.country !== country) {
      return {
        ok: false,
        error:
          "This coupon can only be redeemed from the same country as the purchaser",
      };
    }

    const seat = tx
      .update(coupons)
      .set({ redeemedByUserId: userId, redeemedAt: new Date().toISOString() })
      .where(eq(coupons.id, coupon.id))
      .returning()
      .get();

    const enrollment = tx
      .insert(enrollments)
      .values({ userId, courseId: coupon.courseId })
      .returning()
      .get();

    const notifications: Notification[] = [];
    const seatClaimed = seatClaimedNotification(tx, seat, userId);
    if (seatClaimed) notifications.push(seatClaimed);
    notifications.push(newEnrollmentNotification(tx, enrollment));

    return { ok: true, seat, enrollment, notifications };
  });
}

/**
 * The `seat_claimed` Notification telling the Team Admin that someone claimed
 * one of their Seats. The claimant is the actor, so a Team Admin claiming
 * their own Seat is dropped by sendNotifications.
 */
function seatClaimedNotification(
  tx: Tx,
  seat: typeof coupons.$inferSelect,
  claimantId: number
): Notification | undefined {
  const admin = tx
    .select({ id: users.id, name: users.name })
    .from(teamMembers)
    .innerJoin(users, eq(users.id, teamMembers.userId))
    .where(
      and(
        eq(teamMembers.teamId, seat.teamId),
        eq(teamMembers.role, TeamMemberRole.Admin)
      )
    )
    .get();
  if (!admin) return undefined;

  const claimant = tx
    .select({ id: users.id, name: users.name, avatarUrl: users.avatarUrl })
    .from(users)
    .where(eq(users.id, claimantId))
    .get();
  const course = tx
    .select({ title: schema.courses.title })
    .from(schema.courses)
    .where(eq(schema.courses.id, seat.courseId))
    .get();
  if (!claimant || !course) throw new Error("Seat claim references missing data");

  return {
    kind: "seat_claimed",
    recipient: admin,
    actorId: claimant.id,
    actorAvatarUrl: claimant.avatarUrl,
    title: `${claimant.name} claimed a Seat on ${course.title}`,
    body: `${claimant.name} claimed a Seat on your Team Licence for "${course.title}".`,
    link: "/team",
  };
}
