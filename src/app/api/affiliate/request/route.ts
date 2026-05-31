import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

const MIN_PAYOUT = 20; // minimum $20 to request payout

// POST /api/affiliate/request — request affiliate payout
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  // Check wallet
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { usdtWallet: true },
  });

  if (!user?.usdtWallet) {
    return NextResponse.json(
      { error: "Please set your USDT wallet address in Billing settings first." },
      { status: 400 }
    );
  }

  // Check for existing pending payout
  const existingPayout = await prisma.payout.findFirst({
    where: { userId, status: { in: ["PENDING", "PROCESSING"] } },
  });

  if (existingPayout) {
    return NextResponse.json(
      { error: "You already have a pending payout request. Please wait for it to be processed." },
      { status: 400 }
    );
  }

  // Get all APPROVED commissions for this user's referrals
  const referrals = await prisma.referral.findMany({
    where: { referrerId: userId },
    select: { id: true },
  });

  const referralIds = referrals.map((r) => r.id);

  if (referralIds.length === 0) {
    return NextResponse.json({ error: "No referrals found." }, { status: 400 });
  }

  const approvedCommissions = await prisma.commission.findMany({
    where: {
      referralId: { in: referralIds },
      status: "APPROVED",
      payoutId: null,
    },
  });

  const totalAmount = approvedCommissions.reduce((sum, c) => sum + c.amount, 0);

  if (totalAmount < MIN_PAYOUT) {
    return NextResponse.json(
      { error: `Minimum payout is $${MIN_PAYOUT}. Your current balance is $${totalAmount.toFixed(2)}.` },
      { status: 400 }
    );
  }

  // Create payout request and link commissions
  const payout = await prisma.payout.create({
    data: {
      userId,
      amount: Math.round(totalAmount * 100) / 100,
      usdtAmount: Math.round(totalAmount * 100) / 100, // 1:1 USD to USDT
      walletAddress: user.usdtWallet,
      status: "PENDING",
    },
  });

  // Link commissions to payout
  await prisma.commission.updateMany({
    where: {
      id: { in: approvedCommissions.map((c) => c.id) },
    },
    data: {
      payoutId: payout.id,
      status: "PAID",
    },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      userId,
      action: "payout.requested",
      details: JSON.stringify({
        payoutId: payout.id,
        amount: payout.amount,
        wallet: user.usdtWallet,
        commissionCount: approvedCommissions.length,
      }),
    },
  });

  return NextResponse.json({
    message: `Payout request of $${payout.amount.toFixed(2)} submitted successfully! It will be processed within 48 hours.`,
    payoutId: payout.id,
  });
}
