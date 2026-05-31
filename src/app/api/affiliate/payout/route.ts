import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET /api/affiliate/payout — get payout history
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payouts = await prisma.payout.findMany({
    where: { userId: session.user.id },
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
    },
  });

  return NextResponse.json({ payouts });
}
