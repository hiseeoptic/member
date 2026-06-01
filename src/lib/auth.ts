import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import prisma from "@/lib/prisma";
import { v4 as uuidv4 } from "uuid";
import { authConfig } from "@/lib/auth.config";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  events: {
    async createUser({ user }) {
      if (!user.id) return;

      try {
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

        // Generate referral code (retry on rare collision)
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
      } catch (err) {
        // Never let onboarding failure break the sign-in flow
        console.error("createUser event failed:", err);
      }
    },
  },
});
