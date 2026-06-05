import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { createVnpayUrl } from "@/lib/vnpay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// MONTHLY = $9 = 216 000 VND, YEARLY = $70 = 1 680 000 VND
const PLAN_VND: Record<string, { usd: number; vnd: number }> = {
  MONTHLY: { usd: 9, vnd: 216_000 },
  YEARLY: { usd: 70, vnd: 1_680_000 },
};

// POST /api/payment/vnpay — initiate VNPay payment
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

    // Create a PENDING payment record — method=USDT (VNPay not yet in schema),
    // reviewNote="VNPAY" distinguishes it from real USDT payments.
    const payment = await prisma.payment.create({
      data: {
        userId: session.user.id,
        plan,
        amount: pricing.usd,
        method: "USDT",
        txHash: "", // will be set by VNPay return
        status: "PENDING",
        reviewNote: "VNPAY",
      },
    });

    const ipAddr =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("x-real-ip") ||
      "127.0.0.1";

    const url = createVnpayUrl({
      amount: pricing.vnd,
      orderId: payment.id,
      orderInfo: `Thanh toan Pro ${plan} - member.nguyenduchoa.com`,
      ipAddr,
    });

    return NextResponse.json({ url });
  } catch (err) {
    console.error("/api/payment/vnpay failed:", err);
    return NextResponse.json(
      { error: "Internal error", detail: String(err instanceof Error ? err.message : err) },
      { status: 500 }
    );
  }
}
