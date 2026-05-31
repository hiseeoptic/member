import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

// USDT Payment: user sends USDT to our wallet, submits txHash for manual/auto verification
// POST /api/payment/usdt — submit USDT payment proof
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { plan, txHash, amount } = await req.json();

  if (!plan || !txHash) {
    return NextResponse.json({ error: "Plan and transaction hash required" }, { status: 400 });
  }

  const validPlans = ["MONTHLY", "YEARLY"];
  if (!validPlans.includes(plan)) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  // Store payment record for admin review
  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "payment.usdt_submitted",
      details: JSON.stringify({ plan, txHash, amount, submittedAt: new Date().toISOString() }),
    },
  });

  // For now: auto-approve (in production, admin should verify on-chain)
  const periodEnd = new Date();
  if (plan === "MONTHLY") {
    periodEnd.setMonth(periodEnd.getMonth() + 1);
  } else {
    periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  }

  await prisma.subscription.upsert({
    where: { userId: session.user.id },
    update: {
      status: "ACTIVE",
      plan,
      paymentMethod: "USDT",
      currentPeriodStart: new Date(),
      currentPeriodEnd: periodEnd,
      trialEndsAt: null,
    },
    create: {
      userId: session.user.id,
      status: "ACTIVE",
      plan,
      paymentMethod: "USDT",
      currentPeriodStart: new Date(),
      currentPeriodEnd: periodEnd,
    },
  });

  // Extend license
  await prisma.licenseKey.updateMany({
    where: { userId: session.user.id, status: "ACTIVE" },
    data: { expiresAt: null },
  });

  // Activate referral if exists & create commission
  const pendingReferral = await prisma.referral.findFirst({
    where: { referredUserId: session.user.id, status: "PENDING" },
  });

  if (pendingReferral) {
    await prisma.referral.update({
      where: { id: pendingReferral.id },
      data: { status: "ACTIVE" },
    });
  }

  // Calculate affiliate commission for any active referral
  const activeReferral = await prisma.referral.findUnique({
    where: { referredUserId: session.user.id },
  });

  if (activeReferral && activeReferral.status === "ACTIVE") {
    const planPrice = plan === "YEARLY" ? 149.99 : 19.99;
    const commission = planPrice * activeReferral.commissionRate;

    await prisma.commission.create({
      data: {
        referralId: activeReferral.id,
        amount: commission,
        sourceAmount: planPrice,
        period: new Date().toISOString().slice(0, 7),
        status: "APPROVED",
      },
    });

    await prisma.referral.update({
      where: { id: activeReferral.id },
      data: { totalEarned: { increment: commission } },
    });
  }

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "subscription.activated_usdt",
      details: `Plan: ${plan}, TxHash: ${txHash}`,
    },
  });

  return NextResponse.json({ success: true, plan, expiresAt: periodEnd.toISOString() });
}
