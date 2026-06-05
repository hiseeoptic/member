import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyMomoSignature } from "@/lib/momo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/payment/momo/ipn — MoMo server-to-server webhook
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const signature = String(body["signature"] ?? "");

    // Verify HMAC-SHA256 signature
    if (!verifyMomoSignature(body, signature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const resultCode = Number(body["resultCode"]);
    const orderId = String(body["orderId"] ?? "");
    const transId = String(body["transId"] ?? "");

    if (!orderId) {
      return NextResponse.json({ error: "Missing orderId" }, { status: 400 });
    }

    const payment = await prisma.payment.findUnique({ where: { id: orderId } });
    if (!payment) {
      // Return 204 so MoMo stops retrying for unknown orders
      return new NextResponse(null, { status: 204 });
    }

    if (payment.status !== "PENDING") {
      // Already processed
      return NextResponse.json({ message: "Already processed" }, { status: 200 });
    }

    if (resultCode === 0) {
      // Payment successful
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: "APPROVED",
          txHash: transId,
          reviewedAt: new Date(),
          reviewNote: `MOMO:${transId}`,
        },
      });

      const periodEnd = new Date();
      if (payment.plan === "MONTHLY") periodEnd.setMonth(periodEnd.getMonth() + 1);
      else periodEnd.setFullYear(periodEnd.getFullYear() + 1);

      await prisma.subscription.upsert({
        where: { userId: payment.userId },
        update: {
          status: "ACTIVE",
          plan: payment.plan,
          paymentMethod: "USDT", // MoMo not yet in enum
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
    } else {
      // Payment failed
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: "REJECTED",
          reviewNote: `MOMO_FAIL:${resultCode}`,
          reviewedAt: new Date(),
        },
      });
    }

    // MoMo expects HTTP 200 with a JSON acknowledgement
    return NextResponse.json({ message: "ok" }, { status: 200 });
  } catch (err) {
    console.error("/api/payment/momo/ipn failed:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
