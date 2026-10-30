import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { isLimited, recordAttempt } from "@/lib/rate-limit";
import { signInSchema } from "@/lib/schemas/auth";
import type { Role } from "@/generated/prisma/client";

declare module "next-auth" {
  interface User {
    role: Role;
  }
  interface Session {
    user: { id: string; name: string; role: Role };
  }
}

// Credentials sign-in requires the JWT strategy; the token lives in an HttpOnly, SameSite=Lax cookie (Auth.js default).
// A session cannot be revoked server-side while it is valid: the role and id ride in the token, so a demoted or
// deleted account keeps its access until the cookie expires. Seven days bounds that window. Real revocation needs
// a sessionVersion check against the database on every request — a separate security batch.
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
    jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.sub!;
      session.user.role = token.role as Role;
      return session;
    },
  },
});
