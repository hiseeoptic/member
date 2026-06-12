import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { addCredits } from "@/lib/tokens";
import prisma from "@/lib/prisma";

// POST /api/tokens/bonus — admin-only grant bonus credits
// Body: { userId, amount, description }
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (admin?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId, amount, description } = await req.json();
  if (!userId || !amount || amount <= 0) {
    return NextResponse.json({ error: "userId and positive amount required" }, { status: 400 });
  }

  const newBalance = await addCredits(
    userId,
    Number(amount),
    "BONUS",
    { description: description || "Admin bonus grant" },
    prisma
  );

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "token.bonus.granted",
      details: `To: ${userId}, Amount: ${amount}, Desc: ${description}`,
    },
  });

  return NextResponse.json({ ok: true, newBalance });
}
