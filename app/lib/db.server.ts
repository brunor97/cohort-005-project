import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type * as schema from "~/db/schema";
import { users } from "~/db/schema";

// ─── Database types and shared lookups ───
// The domain modules take the database first, so tests can hand in an
// in-memory one. These are the types they take it as.

export type Db = BetterSQLite3Database<typeof schema>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
/** The database or a transaction on it. */
export type Queryable = Db | Tx;

/** A user as a Notification needs them: recipient or actor. */
export function getUserSummary(db: Queryable, userId: number) {
  return db
    .select({ id: users.id, name: users.name, avatarUrl: users.avatarUrl })
    .from(users)
    .where(eq(users.id, userId))
    .get();
}
