import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET /api/admin/payouts — list all payout requests
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

  const payouts = await prisma.payout.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      amount: true,
      usdtAmount: true,
      walletAddress: true,
      txHash: true,
      status: true,
      processedAt: true,
      createdAt: true,
      user: {
        select: { id: true, name: true, email: true },
      },
      commissions: {
        select: { id: true, amount: true, period: true },
      },
    },
  });

  return NextResponse.json({
    payouts: payouts.map((p) => ({
      id: p.id,
      userName: p.user.name,
      userEmail: p.user.email,
      amount: p.amount,
      usdtAmount: p.usdtAmount,
      walletAddress: p.walletAddress,
      txHash: p.txHash,
      status: p.status,
      commissionCount: p.commissions.length,
      processedAt: p.processedAt?.toISOString() || null,
      createdAt: p.createdAt.toISOString(),
    })),
  });
}

// POST /api/admin/payouts — process a payout (approve/reject/complete)
export async function POST(req: NextRequest) {
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

  const { payoutId, action, txHash } = await req.json();

  if (!payoutId || !action) {
    return NextResponse.json({ error: "payoutId and action required" }, { status: 400 });
  }

  const payout = await prisma.payout.findUnique({
    where: { id: payoutId },
    include: { commissions: true },
  });

  if (!payout) {
    return NextResponse.json({ error: "Payout not found" }, { status: 404 });
  }

  switch (action) {
    case "process":
      await prisma.payout.update({
        where: { id: payoutId },
        data: { status: "PROCESSING" },
      });
      break;

    case "complete":
      if (!txHash) {
        return NextResponse.json({ error: "txHash required for completion" }, { status: 400 });
      }
      await prisma.payout.update({
        where: { id: payoutId },
        data: {
          status: "COMPLETED",
          txHash,
          processedAt: new Date(),
        },
      });

      // Update referral totalEarned
      for (const commission of payout.commissions) {
        await prisma.referral.update({
          where: { id: commission.referralId },
          data: {
            totalEarned: { increment: commission.amount },
          },
        });
      }
      break;

    case "reject":
      // Revert commissions back to APPROVED
      await prisma.commission.updateMany({
        where: { payoutId },
        data: { status: "APPROVED", payoutId: null },
      });
      await prisma.payout.update({
        where: { id: payoutId },
        data: { status: "FAILED" },
      });
      break;

    default:
      return NextResponse.json({ error: "Invalid action. Use: process, complete, reject" }, { status: 400 });
  }

  // Audit log
  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: `admin.payout.${action}`,
      details: JSON.stringify({ payoutId, txHash, amount: payout.amount }),
    },
  });

  return NextResponse.json({ success: true, action });
}
