import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { BCRYPT_COST, signInSchema } from "@/lib/schemas/auth";
import { phoneCandidates } from "@/lib/phone";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { clientIp } from "@/lib/client-ip";
import { isLimited, recordAttempt } from "@/lib/rate-limit";
import type { Role } from "@/generated/prisma/client";

declare module "@auth/core/jwt" {
  interface JWT {
    checkedAt?: number;
    /// The user's passwordChangedAt when this token was issued, in ms. A different value now means the password changed.
    pwdAt?: number;
  }
}

declare module "next-auth" {
  interface User {
    role: Role;
    pwdAt?: number;
  }
  interface Session {
    user: { id: string; name: string; role: Role };
  }
}

// Credentials sign-in requires the JWT strategy; the token lives in an HttpOnly, SameSite=Lax cookie (Auth.js default).
// The role and id ride in the token, so the token is re-checked against the database at most every five minutes:
// a deleted account loses its session and a demoted one its old role within that window (requireStaff reads the
// database on every call, so staff pages and actions lose access at once). Seven days bounds an offline token.
/** How often a live session re-reads the user row. Tests set it to 0 so a reset lands on the next request. */
export const RECHECK_MS = Number(process.env.SESSION_RECHECK_MS ?? 5 * 60_000);

const SEVEN_DAYS = 7 * 24 * 60 * 60;

const NO_ACCOUNT_HASH = bcrypt.hashSync(randomUUID(), BCRYPT_COST);

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt", maxAge: SEVEN_DAYS },
  pages: { signIn: "/signin" },
  providers: [
    Credentials({
      credentials: { login: {}, password: {} },
      async authorize(raw, request) {
        const parsed = signInSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { login } = parsed.data;
        // Two keys: one account cannot be hammered, and one host cannot spray many accounts.
        const ipKey = `login-ip:${clientIp(request.headers)}`;
        if (await isLimited(ipKey, 30, 15 * 60_000)) return null;
        // 10 wrong passwords per account per 15 minutes. The limit counts failures, not attempts:
        // refusing before the comparison let anyone lock a student out with ten guesses.
        const key = `login:${login}`;
        const user = login.includes("@")
          ? await db.user.findUnique({ where: { email: login } })
          : ((await db.user.findUnique({ where: { phone: login } })) ??
            // A local number typed by someone whose account was made with the country-code picker.
            (login.startsWith("+") ? null : await db.user.findFirst({ where: { phone: { in: phoneCandidates(login) } } })));
        // An erased account keeps its row for the money record but can never sign in again.
        if (user?.deletedAt) return null;
        // Compare against a throwaway hash when there is no account, so a missing login takes as long as a wrong password.
        const ok = (await bcrypt.compare(parsed.data.password, user?.passwordHash ?? NO_ACCOUNT_HASH)) && !!user;
        if (!ok || !user) {
          if (!(await isLimited(key, 10, 15 * 60_000))) await recordAttempt(key);
          await recordAttempt(ipKey);
          return null;
        }
        return { id: user.id, name: user.name, role: user.role, pwdAt: user.passwordChangedAt?.getTime() ?? 0 };
      },
    }),
    // Google is added only when its OAuth client is configured. Existing accounts match by email;
    // a new Google user becomes a student and finishes phone, grade and guardian details first.
    ...(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET ? [Google] : []),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider !== "google") return true;
      // Linking by email is only safe when Google vouches for the address.
      if (profile?.email_verified !== true) return false;
      const email = user.email?.trim().toLowerCase();
      if (!email) return false;
      const existing = await db.user.findUnique({
        where: { email },
        select: { id: true, role: true, deletedAt: true, emailVerifiedAt: true, passwordChangedAt: true },
      });
      if (existing) {
        if (existing.deletedAt) return false;
        // Staff keep password sign-in only: a Google account must never open an admin or teacher account.
        if (existing.role !== "STUDENT" && existing.role !== "PARENT") return false;
        user.id = existing.id;
        user.role = existing.role;
        user.pwdAt = existing.passwordChangedAt?.getTime() ?? 0;
        // Google proved the address, so an earlier unverified signup is now verified.
        if (!existing.emailVerifiedAt) {
          await db.user.update({ where: { id: existing.id }, data: { emailVerifiedAt: new Date() } });
        }
        return true;
      }
      // A first Google sign-in creates the row. The random password keeps credentials login closed
      // until the student chooses a password, and the profile page fills phone, grade and consent.
      const created = await db.user.upsert({
        where: { email },
        create: {
          name: user.name?.trim() || email.split("@")[0] || "Student",
          email,
          role: "STUDENT",
          locale: "ar",
          passwordHash: await bcrypt.hash(randomUUID(), BCRYPT_COST),
          emailVerifiedAt: new Date(),
        },
        update: {},
      });
      user.id = created.id;
      user.role = created.role;
      user.pwdAt = created.passwordChangedAt?.getTime() ?? 0;
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.role = user.role;
        token.pwdAt = user.pwdAt ?? 0;
        token.checkedAt = Date.now();
        return token;
      }
      if (typeof token.checkedAt === "number" && Date.now() - token.checkedAt < RECHECK_MS) return token;
      const row = await db.user.findUnique({ where: { id: token.sub! }, select: { role: true, passwordChangedAt: true, deletedAt: true } });
      if (!row || row.deletedAt) return null;
      // A reset or password change after this token was issued ends the session, at the next re-check.
      if ((row.passwordChangedAt?.getTime() ?? 0) !== (token.pwdAt ?? 0)) return null;
      token.role = row.role;
      token.checkedAt = Date.now();
      return token;
    },
    session({ session, token }) {
      session.user.id = token.sub!;
      session.user.role = token.role as Role;
      return session;
    },
  },
});
