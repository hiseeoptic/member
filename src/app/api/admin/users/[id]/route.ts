import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

// POST /api/admin/users/[id] — admin actions on a specific user
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  if (admin?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: userId } = await params;
  const { action, value } = await req.json();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { subscription: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  switch (action) {
    // Activate subscription manually
    case "activate": {
      const plan = value || "MONTHLY";
      const periodEnd = new Date();
      if (plan === "YEARLY") {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      } else {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
      }

      await prisma.subscription.upsert({
        where: { userId },
        update: {
          status: "ACTIVE",
          plan,
          paymentMethod: "USDT",
          currentPeriodStart: new Date(),
          currentPeriodEnd: periodEnd,
          trialEndsAt: null,
        },
        create: {
          userId,
          status: "ACTIVE",
          plan,
          paymentMethod: "USDT",
          currentPeriodStart: new Date(),
          currentPeriodEnd: periodEnd,
        },
      });

      // Reactivate license
      await prisma.licenseKey.updateMany({
        where: { userId },
        data: { status: "ACTIVE", expiresAt: null },
      });

      break;
    }

    // Suspend user subscription
    case "suspend": {
      if (user.subscription) {
        await prisma.subscription.update({
          where: { userId },
          data: { status: "EXPIRED" },
        });
      }
      await prisma.licenseKey.updateMany({
        where: { userId, status: "ACTIVE" },
        data: { status: "EXPIRED" },
      });
      break;
    }

    // Revoke license key
    case "revoke_license": {
      await prisma.licenseKey.updateMany({
        where: { userId, status: "ACTIVE" },
        data: { status: "REVOKED" },
      });
      break;
    }

    // Reset device binding (allow new device)
    case "reset_device": {
      await prisma.licenseKey.updateMany({
        where: { userId },
        data: { deviceId: null },
      });
      // Also release any trial-device claims so the user can start fresh.
      await prisma.trialClaim.deleteMany({ where: { userId } });
      break;
    }

    // Extend trial
    case "extend_trial": {
      const days = parseInt(value) || 15;
      const newEnd = new Date();
      newEnd.setDate(newEnd.getDate() + days);

      await prisma.subscription.upsert({
        where: { userId },
        update: {
          status: "TRIAL",
          trialEndsAt: newEnd,
          currentPeriodEnd: newEnd,
        },
        create: {
          userId,
          status: "TRIAL",
          plan: "MONTHLY",
          trialEndsAt: newEnd,
          currentPeriodStart: new Date(),
          currentPeriodEnd: newEnd,
        },
      });

      // Reactivate license with new expiry
      await prisma.licenseKey.updateMany({
        where: { userId },
        data: { status: "ACTIVE", expiresAt: newEnd },
      });
      break;
    }

    // Set user role
    case "set_role": {
      const role = value === "ADMIN" ? "ADMIN" : "USER";
      await prisma.user.update({
        where: { id: userId },
        data: { role },
      });
      break;
    }

    default:
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  // Audit log
  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: `admin.user.${action}`,
      details: JSON.stringify({ targetUserId: userId, value }),
    },
  });

  return NextResponse.json({ success: true, action });
}
