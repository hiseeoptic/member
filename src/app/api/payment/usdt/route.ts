import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PLAN_PRICE: Record<string, number> = { MONTHLY: 19.99, YEARLY: 149.99 };

// USDT Payment: user sends USDT to our wallet, submits txHash.
// Creates a PENDING payment for ADMIN review (no auto-activation).
// POST /api/payment/usdt
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { plan, txHash } = await req.json();

    if (!plan || !txHash) {
      return NextResponse.json(
        { error: "Plan and transaction hash required" },
        { status: 400 }
      );
    }

    if (!["MONTHLY", "YEARLY"].includes(plan)) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    const cleanHash = String(txHash).trim();

    // Reject obviously invalid hashes
    if (cleanHash.length < 10) {
      return NextResponse.json(
        { error: "Transaction hash looks invalid" },
        { status: 400 }
      );
    }

    // Prevent the same txHash from being submitted twice
    const existing = await prisma.payment.findFirst({
      where: { txHash: cleanHash },
    });
    if (existing) {
      return NextResponse.json(
        { error: "This transaction hash has already been submitted" },
        { status: 409 }
      );
    }

    // Prevent stacking multiple pending requests
    const pending = await prisma.payment.findFirst({
      where: { userId: session.user.id, status: "PENDING" },
    });
    if (pending) {
      return NextResponse.json(
        { error: "You already have a pending payment under review" },
        { status: 409 }
      );
    }

    const payment = await prisma.payment.create({
      data: {
        userId: session.user.id,
        plan,
        amount: PLAN_PRICE[plan],
        method: "USDT",
        txHash: cleanHash,
        status: "PENDING",
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "payment.usdt_submitted",
        details: JSON.stringify({ paymentId: payment.id, plan, txHash: cleanHash }),
        ipAddress:
          req.headers.get("x-forwarded-for") ||
          req.headers.get("x-real-ip") ||
          "unknown",
      },
    });

    return NextResponse.json({
      success: true,
      status: "PENDING",
      message:
        "Payment submitted. Your subscription will activate once an admin verifies the transaction.",
    });
  } catch (err) {
    console.error("/api/payment/usdt failed:", err);
    return NextResponse.json(
      { error: "Internal error", detail: String(err instanceof Error ? err.message : err) },
      { status: 500 }
    );
  }
}
