import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { addCredits } from "@/lib/tokens";

const MIN_PAYOUT_USDT = 20;   // minimum $20 to request USDT payout
const MIN_PAYOUT_TOKENS = 5;  // minimum $5 to convert to credits
const TOKEN_BONUS_RATE = 0.1; // +10% bonus when taking payout as credits

// POST /api/affiliate/request — request affiliate payout
// Body: { method?: "USDT" | "TOKENS" } — default USDT
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const body = await req.json().catch(() => ({}));
  const method: "USDT" | "TOKENS" = body.method === "TOKENS" ? "TOKENS" : "USDT";
  const minPayout = method === "TOKENS" ? MIN_PAYOUT_TOKENS : MIN_PAYOUT_USDT;

  // Check wallet (only needed for USDT)
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { usdtWallet: true },
  });

  if (method === "USDT" && !user?.usdtWallet) {
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

  if (totalAmount < minPayout) {
    return NextResponse.json(
      { error: `Minimum payout is $${minPayout}. Your current balance is $${totalAmount.toFixed(2)}.` },
      { status: 400 }
    );
  }

  const roundedAmount = Math.round(totalAmount * 100) / 100;

  // ── TOKENS: instant conversion to credits (+10% bonus) ─────────────────────
  if (method === "TOKENS") {
    const credits = Math.floor(roundedAmount * 1000 * (1 + TOKEN_BONUS_RATE)); // $1 = 1,000 credits

    const payout = await prisma.payout.create({
      data: {
        userId,
        amount: roundedAmount,
        walletAddress: "TOKEN_CREDITS",
        status: "COMPLETED",
        processedAt: new Date(),
      },
    });

    await prisma.commission.updateMany({
      where: { id: { in: approvedCommissions.map((c) => c.id) } },
      data: { payoutId: payout.id, status: "PAID" },
    });

    await addCredits(
      userId,
      credits,
      "AFFILIATE",
      {
        description: `Hoa hồng affiliate $${roundedAmount.toFixed(2)} → credits (+10% bonus)`,
        refId: payout.id,
      },
      prisma
    );

    await prisma.auditLog.create({
      data: {
        userId,
        action: "payout.tokens",
        details: JSON.stringify({
          payoutId: payout.id,
          amount: roundedAmount,
          credits,
          commissionCount: approvedCommissions.length,
        }),
      },
    });

    return NextResponse.json({
      message: `Converted $${roundedAmount.toFixed(2)} to ${credits.toLocaleString()} credits (incl. 10% bonus) — added to your balance instantly!`,
      payoutId: payout.id,
      credits,
    });
  }

  // ── USDT: manual payout within 48h ─────────────────────────────────────────
  const payout = await prisma.payout.create({
    data: {
      userId,
      amount: roundedAmount,
      usdtAmount: roundedAmount, // 1:1 USD to USDT
      walletAddress: user!.usdtWallet!,
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
        wallet: user!.usdtWallet,
        commissionCount: approvedCommissions.length,
      }),
    },
  });

  return NextResponse.json({
    message: `Payout request of $${payout.amount.toFixed(2)} submitted successfully! It will be processed within 48 hours.`,
    payoutId: payout.id,
  });
}
