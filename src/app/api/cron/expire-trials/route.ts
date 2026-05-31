import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET /api/cron/expire-trials — expire overdue trials
// Call via Vercel Cron or external scheduler every hour
export async function GET(req: NextRequest) {
  // Verify cron secret (set in Vercel env)
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  // Find expired trials
  const expiredTrials = await prisma.subscription.findMany({
    where: {
      status: "TRIAL",
      trialEndsAt: { lt: now },
    },
    select: { id: true, userId: true },
  });

  if (expiredTrials.length === 0) {
    return NextResponse.json({ message: "No trials to expire", count: 0 });
  }

  // Batch expire subscriptions
  await prisma.subscription.updateMany({
    where: {
      id: { in: expiredTrials.map((t) => t.id) },
    },
    data: { status: "EXPIRED" },
  });

  // Batch expire license keys
  const userIds = expiredTrials.map((t) => t.userId);
  await prisma.licenseKey.updateMany({
    where: {
      userId: { in: userIds },
      status: "ACTIVE",
    },
    data: { status: "EXPIRED" },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      action: "cron.trials_expired",
      details: JSON.stringify({
        count: expiredTrials.length,
        userIds,
        timestamp: now.toISOString(),
      }),
    },
  });

  return NextResponse.json({
    message: `Expired ${expiredTrials.length} trials`,
    count: expiredTrials.length,
  });
}
