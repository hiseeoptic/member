import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET /api/admin/stats — platform overview + financial report
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [
    totalUsers,
    activeSubscriptions,
    trialUsers,
    expiredUsers,
    totalReferrals,
    activeReferrals,
    pendingPayouts,
    completedPayouts,
    recentSignups,
    // Financials
    approvedPayments, // real money in (USDT, admin-approved)
    pendingPayments,
    commissionsOwed, // PENDING + APPROVED commissions (not yet paid out)
    commissionsPaid, // PAID commissions
  ] = await Promise.all([
    prisma.user.count(),
    prisma.subscription.count({ where: { status: "ACTIVE" } }),
    prisma.subscription.count({ where: { status: "TRIAL" } }),
    prisma.subscription.count({ where: { status: { in: ["EXPIRED", "CANCELLED"] } } }),
    prisma.referral.count(),
    prisma.referral.count({ where: { status: "ACTIVE" } }),
    prisma.payout.count({ where: { status: { in: ["PENDING", "PROCESSING"] } } }),
    prisma.payout.aggregate({ where: { status: "COMPLETED" }, _sum: { amount: true } }),
    prisma.user.count({ where: { createdAt: { gte: new Date(Date.now() - 7 * 86400000) } } }),
    prisma.payment.aggregate({ where: { status: "APPROVED" }, _sum: { amount: true }, _count: true }),
    prisma.payment.count({ where: { status: "PENDING" } }),
    prisma.commission.aggregate({ where: { status: { in: ["PENDING", "APPROVED"] } }, _sum: { amount: true } }),
    prisma.commission.aggregate({ where: { status: "PAID" }, _sum: { amount: true } }),
  ]);

  const grossRevenue = approvedPayments._sum.amount || 0;
  const owed = commissionsOwed._sum.amount || 0;
  const paidComm = commissionsPaid._sum.amount || 0;
  const paidOut = completedPayouts._sum.amount || 0;

  // Net = money in − commissions already paid out to affiliates.
  const netRevenue = grossRevenue - paidOut;

  const round = (n: number) => Math.round(n * 100) / 100;

  return NextResponse.json({
    // Users
    totalUsers,
    activeSubscriptions,
    trialUsers,
    expiredUsers,
    recentSignups,
    // Affiliate
    totalReferrals,
    activeReferrals,
    pendingPayouts,
    // Financials
    grossRevenue: round(grossRevenue),
    paidCustomers: approvedPayments._count || 0,
    pendingPayments,
    commissionsOwed: round(owed),
    commissionsPaid: round(paidComm),
    totalPaidOut: round(paidOut),
    netRevenue: round(netRevenue),
    // Back-compat
    estimatedRevenue: round(grossRevenue),
  });
}
