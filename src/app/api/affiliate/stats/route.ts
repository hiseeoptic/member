import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET /api/affiliate/stats — full affiliate dashboard data
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  // Get user with referral code
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      usdtWallet: true,
      referralCode: {
        select: {
          code: true,
          clicks: true,
          referrals: {
            select: {
              id: true,
              status: true,
              totalEarned: true,
              createdAt: true,
              referredUser: {
                select: { email: true, name: true },
              },
              commissions: {
                select: {
                  id: true,
                  amount: true,
                  sourceAmount: true,
                  period: true,
                  status: true,
                  createdAt: true,
                },
                orderBy: { createdAt: "desc" },
              },
            },
            orderBy: { createdAt: "desc" },
          },
        },
      },
      payouts: {
        select: {
          id: true,
          amount: true,
          usdtAmount: true,
          status: true,
          txHash: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!user?.referralCode) {
    return NextResponse.json({ error: "No referral code found" }, { status: 404 });
  }

  const rc = user.referralCode;
  const referrals = rc.referrals;

  // Aggregate stats
  const totalReferrals = referrals.length;
  const activeReferrals = referrals.filter((r) => r.status === "ACTIVE").length;

  // All commissions across all referrals
  const allCommissions = referrals.flatMap((r) => r.commissions);
  const totalEarnings = allCommissions.reduce((sum, c) => sum + c.amount, 0);

  // Pending payout = APPROVED commissions not yet paid out
  const pendingPayout = allCommissions
    .filter((c) => c.status === "APPROVED")
    .reduce((sum, c) => sum + c.amount, 0);

  const baseUrl = process.env.NEXTAUTH_URL || "https://member.nguyenduchoa.com";

  return NextResponse.json({
    referralCode: rc.code,
    referralLink: `${baseUrl}/ref/${rc.code}`,
    clicks: rc.clicks,
    totalReferrals,
    activeReferrals,
    totalEarnings: Math.round(totalEarnings * 100) / 100,
    pendingPayout: Math.round(pendingPayout * 100) / 100,
    minPayout: 20, // minimum $20 to withdraw
    usdtWallet: user.usdtWallet,
    referrals: referrals.map((r) => ({
      user: r.referredUser.email
        ? `${r.referredUser.email.slice(0, 3)}***@${r.referredUser.email.split("@")[1]}`
        : r.referredUser.name || "Unknown",
      status: r.status,
      earned: Math.round(r.totalEarned * 100) / 100,
      joinedAt: r.createdAt.toISOString(),
    })),
    commissions: allCommissions.map((c) => ({
      period: c.period,
      amount: Math.round(c.amount * 100) / 100,
      sourceAmount: Math.round(c.sourceAmount * 100) / 100,
      status: c.status,
      createdAt: c.createdAt.toISOString(),
    })),
    payouts: user.payouts.map((p) => ({
      amount: Math.round(p.amount * 100) / 100,
      usdtAmount: p.usdtAmount ? Math.round(p.usdtAmount * 100) / 100 : null,
      status: p.status,
      txHash: p.txHash,
      createdAt: p.createdAt.toISOString(),
    })),
  });
}
