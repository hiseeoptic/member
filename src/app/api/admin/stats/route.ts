import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET /api/admin/stats — platform overview stats
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check admin role
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  if (user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Aggregate stats
  const [
    totalUsers,
    activeSubscriptions,
    trialUsers,
    expiredUsers,
    totalReferrals,
    pendingPayouts,
    completedPayouts,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.subscription.count({ where: { status: "ACTIVE" } }),
    prisma.subscription.count({ where: { status: "TRIAL" } }),
    prisma.subscription.count({ where: { status: { in: ["EXPIRED", "CANCELLED"] } } }),
    prisma.referral.count(),
    prisma.payout.count({ where: { status: { in: ["PENDING", "PROCESSING"] } } }),
    prisma.payout.aggregate({ where: { status: "COMPLETED" }, _sum: { amount: true } }),
  ]);

  // Revenue estimate (from commissions source amounts)
  const totalRevenue = await prisma.commission.aggregate({
    _sum: { sourceAmount: true },
  });

  // Recent signups (last 7 days)
  const recentSignups = await prisma.user.count({
    where: {
      createdAt: { gte: new Date(Date.now() - 7 * 86400000) },
    },
  });

  return NextResponse.json({
    totalUsers,
    activeSubscriptions,
    trialUsers,
    expiredUsers,
    totalReferrals,
    pendingPayouts,
    totalPaidOut: completedPayouts._sum.amount || 0,
    estimatedRevenue: totalRevenue._sum.sourceAmount || 0,
    recentSignups,
  });
}
