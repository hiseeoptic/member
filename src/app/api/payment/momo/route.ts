import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { createMomoPayment } from "@/lib/momo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// MONTHLY = $9 = 216 000 VND, YEARLY = $70 = 1 680 000 VND
const PLAN_VND: Record<string, { usd: number; vnd: number }> = {
  MONTHLY: { usd: 9, vnd: 216_000 },
  YEARLY: { usd: 70, vnd: 1_680_000 },
};

// POST /api/payment/momo — initiate MoMo payment
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { plan } = await req.json();
    if (!plan || !["MONTHLY", "YEARLY"].includes(plan)) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    const pricing = PLAN_VND[plan];

    // Create PENDING payment — method=USDT (MoMo not yet in schema),
    // reviewNote="MOMO" distinguishes it from real USDT payments.
    const payment = await prisma.payment.create({
      data: {
        userId: session.user.id,
        plan,
        amount: pricing.usd,
        method: "USDT",
        txHash: "", // will be set by MoMo IPN
        status: "PENDING",
        reviewNote: "MOMO",
      },
    });

    const result = await createMomoPayment({
      amount: pricing.vnd,
      orderId: payment.id,
      orderInfo: `Thanh toan Pro ${plan} - member.nguyenduchoa.com`,
      requestId: payment.id,
    });

    if (result.resultCode !== 0) {
      // Remove the pending payment record if MoMo rejected the request
      await prisma.payment.delete({ where: { id: payment.id } });
      return NextResponse.json(
        { error: "MoMo payment creation failed", detail: result.message },
        { status: 502 }
      );
    }

    return NextResponse.json({ url: result.payUrl });
  } catch (err) {
    console.error("/api/payment/momo failed:", err);
    return NextResponse.json(
      { error: "Internal error", detail: String(err instanceof Error ? err.message : err) },
      { status: 500 }
    );
  }
}
