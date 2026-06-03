import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET /api/admin/affiliates — affiliate leaderboard + each one's downline (1 tier)
export async function GET() {
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

  // Only users who actually referred someone (have ≥1 referral as referrer).
  const codes = await prisma.referralCode.findMany({
    where: { referrals: { some: {} } },
    select: {
      code: true,
      clicks: true,
      user: { select: { id: true, name: true, email: true, trialEmail: true, usdtWallet: true } },
      referrals: {
        select: {
          status: true,
          totalEarned: true,
          createdAt: true,
          referredUser: { select: { email: true, name: true } },
          commissions: { select: { amount: true, status: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  const round = (n: number) => Math.round(n * 100) / 100;

  const affiliates = codes
    .map((c) => {
      const refs = c.referrals;
      const allComms = refs.flatMap((r) => r.commissions);
      const totalEarned = allComms.reduce((s, k) => s + k.amount, 0);
      const pending = allComms
        .filter((k) => k.status === "APPROVED")
        .reduce((s, k) => s + k.amount, 0);
      const paid = allComms
        .filter((k) => k.status === "PAID")
        .reduce((s, k) => s + k.amount, 0);

      return {
        userId: c.user.id,
        name: c.user.name,
        email: c.user.email || c.user.trialEmail,
        code: c.code,
        clicks: c.clicks,
        wallet: c.user.usdtWallet,
        totalReferrals: refs.length,
        activeReferrals: refs.filter((r) => r.status === "ACTIVE").length,
        totalEarned: round(totalEarned),
        pendingPayout: round(pending),
        paidOut: round(paid),
        downline: refs.map((r) => ({
          user: r.referredUser.email || r.referredUser.name || "Unknown",
          status: r.status,
          earned: round(r.totalEarned),
          joinedAt: r.createdAt.toISOString(),
        })),
      };
    })
    .sort((a, b) => b.totalReferrals - a.totalReferrals || b.totalEarned - a.totalEarned);

  return NextResponse.json({ affiliates, count: affiliates.length });
}
