import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import prisma from "@/lib/prisma";
import { v4 as uuidv4 } from "uuid";

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
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
  events: {
    async createUser({ user }) {
      if (!user.id) return;

      // Create trial subscription (15 days)
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + 15);

      await prisma.subscription.create({
        data: {
          userId: user.id,
          status: "TRIAL",
          plan: "MONTHLY",
          trialEndsAt: trialEnd,
          currentPeriodStart: new Date(),
          currentPeriodEnd: trialEnd,
        },
      });

      // Generate license key
      const licenseKey = `AF-${uuidv4().split("-").slice(0, 3).join("-").toUpperCase()}`;
      await prisma.licenseKey.create({
        data: {
          key: licenseKey,
          userId: user.id,
          status: "ACTIVE",
          expiresAt: trialEnd,
        },
      });

      // Generate referral code
      const name = user.name?.replace(/\s+/g, "").slice(0, 6).toUpperCase() || "USER";
      const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
      await prisma.referralCode.create({
        data: {
          code: `${name}${suffix}`,
          userId: user.id,
        },
      });

      // Audit log
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: "user.created",
          details: `Trial ends: ${trialEnd.toISOString()}`,
        },
      });
    },
  },
});
