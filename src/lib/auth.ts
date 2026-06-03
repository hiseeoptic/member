import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import prisma from "@/lib/prisma";
import { v4 as uuidv4 } from "uuid";
import { authConfig } from "@/lib/auth.config";
import { isAdminEmail } from "@/lib/admins";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  events: {
    // Runs on every sign-in (new & existing users) — keeps admin role in sync in the DB
    async signIn({ user }) {
      if (user?.id && isAdminEmail(user.email)) {
        await prisma.user
          .update({ where: { id: user.id }, data: { role: "ADMIN" } })
          .catch((err) => console.error("admin role sync failed:", err));
      }
    },
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

        // Generate referral code — ASCII only (strip Vietnamese diacritics &
        // any non-alphanumeric chars so the code is URL/clipboard-safe).
        const base =
          (user.name || "USER")
            .replace(/[Đđ]/g, "D") // Đ doesn't decompose in NFD
            .normalize("NFD")
            .replace(/[̀-ͯ]/g, "") // remove diacritics (combining marks)
            .replace(/[^a-zA-Z0-9]/g, "")
            .slice(0, 6)
            .toUpperCase() || "USER";
        const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
        await prisma.referralCode.create({
          data: {
            code: `${base}${suffix}`,
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

        // ===== Link referral at signup (server-side, reliable) =====
        // Reads the "ref" cookie set by /ref/[code]. Doing it here (during the
        // OAuth callback request) is far more robust than waiting for the
        // dashboard to fire a tracking call.
        try {
          const { cookies } = await import("next/headers");
          const store = await cookies();
          const refCode = store.get("ref")?.value?.toUpperCase();
          if (refCode) {
            const rc = await prisma.referralCode.findUnique({ where: { code: refCode } });
            if (rc && rc.userId !== user.id) {
              const already = await prisma.referral.findUnique({
                where: { referredUserId: user.id },
              });
              if (!already) {
                await prisma.referral.create({
                  data: {
                    referralCodeId: rc.id,
                    referrerId: rc.userId,
                    referredUserId: user.id,
                    status: "PENDING",
                    commissionRate: 0.2,
                  },
                });
                await prisma.auditLog.create({
                  data: {
                    userId: user.id,
                    action: "referral.tracked",
                    details: `Referred by ${refCode} (at signup)`,
                  },
                });
              }
            }
          }
        } catch (e) {
          console.error("referral link at signup failed:", e);
        }
      } catch (err) {
        // Never let onboarding failure break the sign-in flow
        console.error("createUser event failed:", err);
      }
    },
  },
});
