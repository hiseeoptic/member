import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getOrCreateBalance } from "@/lib/tokens";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const balance = await getOrCreateBalance(session.user.id, prisma);
  const recent = await prisma.tokenTransaction.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return NextResponse.json({ balance: balance.balance, transactions: recent });
}
