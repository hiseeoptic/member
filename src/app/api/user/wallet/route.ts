import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

// POST /api/user/wallet — update USDT wallet address
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { walletAddress } = await req.json();

  // Basic TRC-20 validation (starts with T, 34 chars)
  if (!walletAddress || !/^T[a-zA-Z0-9]{33}$/.test(walletAddress)) {
    return NextResponse.json(
      { error: "Invalid TRC-20 USDT wallet address" },
      { status: 400 }
    );
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { usdtWallet: walletAddress },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "wallet.updated",
      details: `Wallet: ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`,
    },
  });

  return NextResponse.json({ success: true, walletAddress });
}
