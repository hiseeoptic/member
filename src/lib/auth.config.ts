import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import { isAdminEmail } from "@/lib/admins";

// Edge-safe auth config (NO Prisma, NO adapter) — shared by middleware & full auth
export const authConfig = {
  secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET,
  trustHost: true,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        // @ts-expect-error - role is added by Prisma
        token.role = user.role || "USER";
      }
      // Designated admin emails are always ADMIN (works even before DB sync)
      if (isAdminEmail(token.email as string | undefined)) {
        token.role = "ADMIN";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        // @ts-expect-error - role extension
        session.user.role = token.role;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
