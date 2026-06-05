import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/payment/momo/return — MoMo redirects user here after payment
// The actual payment processing is handled by the IPN webhook.
// This route just redirects the user to the dashboard with a status message.
export async function GET(req: NextRequest) {
  const baseUrl = process.env.NEXTAUTH_URL || "https://member.nguyenduchoa.com";
  const searchParams = req.nextUrl.searchParams;

  const resultCode = searchParams.get("resultCode");
  const orderId = searchParams.get("orderId") ?? "";

  if (resultCode === "0") {
    // Payment successful — IPN webhook will (or already has) activated the subscription
    return NextResponse.redirect(
      `${baseUrl}/dashboard?payment=success&method=momo&ref=${orderId}`
    );
  }

  // Non-zero result code → failed or cancelled
  return NextResponse.redirect(
    `${baseUrl}/dashboard?payment=cancelled&method=momo&code=${resultCode ?? "unknown"}`
  );
}
