import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { clientIp } from "@/lib/client-ip";
import { isLimited, recordAttempt } from "@/lib/rate-limit";
import { signInSchema } from "@/lib/schemas/auth";
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
        const user = await db.user.findUnique({ where: login.includes("@") ? { email: login } : { phone: login } });
        const ok = user ? await bcrypt.compare(parsed.data.password, user.passwordHash) : false;
        if (!ok || !user) {
          if (!(await isLimited(key, 10, 15 * 60_000))) await recordAttempt(key);
          await recordAttempt(ipKey);
          return null;
        }
        return { id: user.id, name: user.name, role: user.role, pwdAt: user.passwordChangedAt?.getTime() ?? 0 };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.role = user.role;
        token.pwdAt = user.pwdAt ?? 0;
        token.checkedAt = Date.now();
        return token;
      }
      if (typeof token.checkedAt === "number" && Date.now() - token.checkedAt < RECHECK_MS) return token;
      const row = await db.user.findUnique({ where: { id: token.sub! }, select: { role: true, passwordChangedAt: true } });
      if (!row) return null;
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
