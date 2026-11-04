// Direct SQL access to the throwaway e2e database, for rows the app only creates by email. Plain `pg`, because
// Playwright's loader cannot import the generated Prisma client (it uses import.meta).
import bcrypt from "bcryptjs";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import pg from "pg";
import { PASSWORD } from "./personas";

const url = process.env.DATABASE_URL ?? "";
if (!url.includes("@localhost:54329/dhirwa_e2e")) throw new Error("e2e db helper runs only on the throwaway e2e database");

export async function sql<T = unknown>(text: string, params: unknown[] = []) {
  const c = new pg.Client({ connectionString: url });
  await c.connect();
  try {
    return (await c.query(text, params)).rows as T[];
  } finally {
    await c.end();
  }
}

/** A fresh student with an email, plus a valid password-reset token for it (the raw value the email would carry). */
export async function userWithResetToken(tag: string) {
  const id = randomUUID();
  const phone = `05${String(Date.now()).slice(-8)}`;
  await sql(`INSERT INTO "User" (id, name, phone, email, "passwordHash", role, locale) VALUES ($1,$2,$3,$4,$5,'STUDENT','ar')`, [
    id, `E2E Reset ${tag}`, phone, `reset-${Date.now()}@example.test`, await bcrypt.hash(PASSWORD, 10),
  ]);
  const raw = randomBytes(32).toString("base64url");
  await sql(`INSERT INTO "Token" (id, "userId", kind, "tokenHash", "expiresAt") VALUES ($1,$2,'RESET',$3,(now() at time zone 'utc') + interval '30 minutes')`, [
    randomUUID(), id, createHash("sha256").update(raw).digest("hex"),
  ]);
  return { phone, raw };
}

/** A fresh student with no purchases. */
export async function freshStudent(tag: string) {
  const id = randomUUID();
  const phone = `05${String(Date.now()).slice(-8)}`;
  await sql(`INSERT INTO "User" (id, name, phone, "passwordHash", role, locale) VALUES ($1,$2,$3,$4,'STUDENT','ar')`, [
    id, `E2E ${tag}`, phone, await bcrypt.hash(PASSWORD, 10),
  ]);
  return { id, phone };
}

/** Lesson ids of a seeded course: one in the free unit, one in a paid unit. */
export async function lessonsOf(courseSlug: string) {
  const rows = await sql<{ id: string; isFree: boolean; courseId: string }>(
    `SELECT l.id, u."isFree", c.id AS "courseId" FROM "Lesson" l JOIN "Unit" u ON u.id = l."unitId" JOIN "Course" c ON c.id = u."courseId"
     WHERE c.slug = $1 AND l."order" = 1 ORDER BY u."order"`,
    [courseSlug],
  );
  return { free: rows.find((r) => r.isFree)!.id, paid: rows.find((r) => !r.isFree)!.id, courseId: rows[0].courseId };
}

export async function grantCourse(userId: string, courseId: string) {
  await sql(`INSERT INTO "Entitlement" (id, "userId", "courseId", "accessType", "startsAt", "endsAt") VALUES ($1,$2,$3,'YEARLY',(now() at time zone 'utc') - interval '1 minute',(now() at time zone 'utc') + interval '1 year')`, [
    randomUUID(), userId, courseId,
  ]);
}
