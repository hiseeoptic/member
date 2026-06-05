import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyVnpayReturn } from "@/lib/vnpay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/payment/vnpay/return — VNPay redirects user here after payment
export async function GET(req: NextRequest) {
  const baseUrl = process.env.NEXTAUTH_URL || "https://member.nguyenduchoa.com";
  const searchParams = req.nextUrl.searchParams;

  const query: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    query[key] = value;
  });

  // Verify signature
  const isValid = verifyVnpayReturn(query);
  if (!isValid) {
    return NextResponse.redirect(
      `${baseUrl}/dashboard?payment=error&reason=invalid_signature`
    );
  }

  const responseCode = query["vnp_ResponseCode"];
  const txnRef = query["vnp_TxnRef"]; // our payment.id (orderId)
  const vnpTxnNo = query["vnp_TransactionNo"] ?? "";

  if (!txnRef) {
    return NextResponse.redirect(`${baseUrl}/dashboard?payment=error&reason=missing_ref`);
  }

  const payment = await prisma.payment.findUnique({ where: { id: txnRef } });
  if (!payment) {
    return NextResponse.redirect(`${baseUrl}/dashboard?payment=error&reason=not_found`);
  }

  if (responseCode === "00") {
    // Payment successful — update Payment and activate Subscription
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "APPROVED",
        txHash: vnpTxnNo,
        reviewedAt: new Date(),
        reviewNote: `VNPAY:${vnpTxnNo}`,
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
        paymentMethod: "USDT", // VNPay not yet in enum — store as USDT
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

    return NextResponse.redirect(`${baseUrl}/dashboard?payment=success&method=vnpay`);
  }

  // Non-zero response code → failed / cancelled
  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: "REJECTED",
      reviewNote: `VNPAY_FAIL:${responseCode}`,
      reviewedAt: new Date(),
    },
  });

  return NextResponse.redirect(
    `${baseUrl}/dashboard?payment=cancelled&method=vnpay&code=${responseCode}`
  );
}
