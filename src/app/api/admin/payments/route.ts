import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { notifyNewCommission } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized", status: 401 as const };
  const admin = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (admin?.role !== "ADMIN") return { error: "Forbidden", status: 403 as const };
  return { adminId: session.user.id };
}

// GET /api/admin/payments — list USDT payments (pending first)
export async function GET() {
  const gate = await requireAdmin();
  if ("error" in gate) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const payments = await prisma.payment.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      plan: true,
      amount: true,
      method: true,
      txHash: true,
      status: true,
      reviewNote: true,
      reviewedAt: true,
      createdAt: true,
      user: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json({
    payments: payments.map((p) => ({
      id: p.id,
      userName: p.user.name,
      userEmail: p.user.email,
      plan: p.plan,
      amount: p.amount,
      method: p.method,
      txHash: p.txHash,
      status: p.status,
      reviewNote: p.reviewNote,
      reviewedAt: p.reviewedAt?.toISOString() || null,
      createdAt: p.createdAt.toISOString(),
    })),
  });
}

// POST /api/admin/payments — approve or reject a USDT payment
export async function POST(req: NextRequest) {
  const gate = await requireAdmin();
  if ("error" in gate) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }
  const adminId = gate.adminId;

  const { paymentId, action, note } = await req.json();
  if (!paymentId || !action) {
    return NextResponse.json({ error: "paymentId and action required" }, { status: 400 });
  }

  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }
  if (payment.status !== "PENDING") {
    return NextResponse.json(
      { error: `Payment already ${payment.status.toLowerCase()}` },
      { status: 409 }
    );
  }

  if (action === "reject") {
    await prisma.payment.update({
      where: { id: paymentId },
      data: { status: "REJECTED", reviewedBy: adminId, reviewedAt: new Date(), reviewNote: note || null },
    });
    await prisma.auditLog.create({
      data: {
        userId: adminId,
        action: "admin.payment.reject",
        details: JSON.stringify({ paymentId, txHash: payment.txHash }),
      },
    });
    return NextResponse.json({ success: true, action });
  }

  if (action !== "approve") {
    return NextResponse.json({ error: "Invalid action. Use: approve, reject" }, { status: 400 });
  }

  // === APPROVE: activate subscription ===
  const periodEnd = new Date();
  if (payment.plan === "MONTHLY") periodEnd.setMonth(periodEnd.getMonth() + 1);
  else periodEnd.setFullYear(periodEnd.getFullYear() + 1);

  await prisma.subscription.upsert({
    where: { userId: payment.userId },
    update: {
      status: "ACTIVE",
      plan: payment.plan,
      paymentMethod: "USDT",
      currentPeriodStart: new Date(),
      currentPeriodEnd: periodEnd,
      trialEndsAt: null,
    },
    create: {
      userId: payment.userId,
      status: "ACTIVE",
      plan: payment.plan,
      paymentMethod: "USDT",
      currentPeriodStart: new Date(),
      currentPeriodEnd: periodEnd,
    },
  });

  // Re-activate license keys
  await prisma.licenseKey.updateMany({
    where: { userId: payment.userId },
    data: { status: "ACTIVE", expiresAt: periodEnd },
  });

  // Activate pending referral and create affiliate commission
  const referral = await prisma.referral.findUnique({
    where: { referredUserId: payment.userId },
  });
  if (referral) {
    if (referral.status === "PENDING") {
      await prisma.referral.update({
        where: { id: referral.id },
        data: { status: "ACTIVE" },
      });
    }
    const commission = payment.amount * referral.commissionRate;
    await prisma.commission.create({
      data: {
        referralId: referral.id,
        amount: commission,
        sourceAmount: payment.amount,
        period: new Date().toISOString().slice(0, 7),
        status: "APPROVED",
      },
    });
    await prisma.referral.update({
      where: { id: referral.id },
      data: { totalEarned: { increment: commission } },
    });
    // Notify the referrer they earned a commission (best-effort)
    const referrer = await prisma.user.findUnique({
      where: { id: referral.referrerId },
      select: { email: true },
    });
    if (referrer?.email) await notifyNewCommission(referrer.email, commission);
  }

  await prisma.payment.update({
    where: { id: paymentId },
    data: { status: "APPROVED", reviewedBy: adminId, reviewedAt: new Date(), reviewNote: note || null },
  });

  await prisma.auditLog.create({
    data: {
      userId: adminId,
      action: "admin.payment.approve",
      details: JSON.stringify({ paymentId, userId: payment.userId, plan: payment.plan, txHash: payment.txHash }),
    },
  });

  return NextResponse.json({ success: true, action, expiresAt: periodEnd.toISOString() });
}
