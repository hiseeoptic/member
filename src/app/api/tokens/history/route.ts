import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET /api/tokens/history?page=1&limit=50
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") || 50)));
  const skip = (page - 1) * limit;

  const [transactions, total] = await Promise.all([
    prisma.tokenTransaction.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.tokenTransaction.count({ where: { userId: session.user.id } }),
  ]);

  return NextResponse.json({ transactions, total, page, limit });
}
