import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET /api/user/me — full user profile with subscription + affiliate
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      subscription: true,
      licenseKeys: { where: { status: "ACTIVE" }, take: 1 },
      referralCode: true,
      referrals: {
        include: {
          referredUser: { select: { name: true, email: true, createdAt: true } },
        },
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Calculate total earnings
  const totalEarnings = user.referrals.reduce((sum, r) => sum + r.totalEarned, 0);

  // Get pending payout amount
  const pendingCommissions = await prisma.commission.aggregate({
    where: {
      referral: { referrerId: user.id },
      status: { in: ["APPROVED"] },
      payoutId: null,
    },
    _sum: { amount: true },
  });

  return NextResponse.json({
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
    role: user.role,
    usdtWallet: user.usdtWallet,
    subscription: user.subscription,
    licenseKey: user.licenseKeys[0]?.key || null,
    referralCode: user.referralCode?.code || null,
    referralLink: user.referralCode
      ? `${process.env.NEXTAUTH_URL || "https://app.nguyenduchoa.com"}/ref/${user.referralCode.code}`
      : null,
    affiliate: {
      totalReferrals: user.referrals.length,
      activeReferrals: user.referrals.filter((r) => r.status === "ACTIVE").length,
      totalEarnings,
      pendingPayout: pendingCommissions._sum.amount || 0,
      referrals: user.referrals.map((r) => ({
        user: r.referredUser.name || r.referredUser.email,
        status: r.status,
        earned: r.totalEarned,
        joinedAt: r.createdAt,
      })),
    },
    createdAt: user.createdAt,
  });
}
