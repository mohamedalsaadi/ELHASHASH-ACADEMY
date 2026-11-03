import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { isLimited, recordAttempt } from "@/lib/rate-limit";
import { signInSchema } from "@/lib/schemas/auth";
import type { Role } from "@/generated/prisma/client";

declare module "@auth/core/jwt" {
  interface JWT {
    checkedAt?: number;
  }
}

declare module "next-auth" {
  interface User {
    role: Role;
  }
  interface Session {
    user: { id: string; name: string; role: Role };
  }
}

// Credentials sign-in requires the JWT strategy; the token lives in an HttpOnly, SameSite=Lax cookie (Auth.js default).
// The role and id ride in the token, so the token is re-checked against the database at most every five minutes:
// a deleted account loses its session and a demoted one its old role within that window (requireStaff reads the
// database on every call, so staff pages and actions lose access at once). Seven days bounds an offline token.
export const RECHECK_MS = 5 * 60_000;

const SEVEN_DAYS = 7 * 24 * 60 * 60;

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt", maxAge: SEVEN_DAYS },
  pages: { signIn: "/signin" },
  providers: [
    Credentials({
      credentials: { login: {}, password: {} },
      async authorize(raw) {
        const parsed = signInSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { login } = parsed.data;
        // 10 wrong passwords per account per 15 minutes, then every attempt is refused until the window passes.
        const key = `login:${login}`;
        if (await isLimited(key, 10, 15 * 60_000)) return null;
        const user = await db.user.findUnique({ where: login.includes("@") ? { email: login } : { phone: login } });
        if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
          await recordAttempt(key);
          return null;
        }
        return { id: user.id, name: user.name, role: user.role };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.role = user.role;
        token.checkedAt = Date.now();
        return token;
      }
      if (typeof token.checkedAt === "number" && Date.now() - token.checkedAt < RECHECK_MS) return token;
      const row = await db.user.findUnique({ where: { id: token.sub! }, select: { role: true } });
      if (!row) return null;
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
