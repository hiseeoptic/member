import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { cookies } from "next/headers";
import { notifyNewReferral } from "@/lib/email";

// POST /api/referral/track — called after signup to link referral
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check cookie first, then body
  const cookieStore = await cookies();
  const refCookie = cookieStore.get("ref")?.value;
  const body = await req.json().catch(() => ({}));
  const refCode = (body.ref || refCookie || "").toUpperCase();

  if (!refCode) {
    return NextResponse.json({ message: "No referral code" });
  }

  // Check if user already has a referral record
  const existingReferral = await prisma.referral.findUnique({
    where: { referredUserId: session.user.id },
  });

  if (existingReferral) {
    return NextResponse.json({ message: "Referral already tracked" });
  }

  // Find the referral code
  const referralCode = await prisma.referralCode.findUnique({
    where: { code: refCode },
  });

  if (!referralCode) {
    return NextResponse.json({ message: "Invalid referral code" });
  }

  // Don't allow self-referral
  if (referralCode.userId === session.user.id) {
    return NextResponse.json({ message: "Cannot self-refer" });
  }

  // Create referral record
  await prisma.referral.create({
    data: {
      referralCodeId: referralCode.id,
      referrerId: referralCode.userId,
      referredUserId: session.user.id,
      status: "PENDING",
      commissionRate: 0.20,
    },
  });

  // Clear the cookie
  cookieStore.delete("ref");

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "referral.tracked",
      details: `Referred by: ${referralCode.code}`,
    },
  });

  // Notify the referrer that someone signed up via their link (best-effort)
  try {
    const referrer = await prisma.user.findUnique({
      where: { id: referralCode.userId },
      select: { email: true },
    });
    const e = session.user.email;
    const masked = e ? `${e.slice(0, 3)}***@${e.split("@")[1]}` : "một người dùng mới";
    if (referrer?.email) await notifyNewReferral(referrer.email, masked);
  } catch {
    /* never block signup tracking on email failure */
  }

  return NextResponse.json({ success: true, message: "Referral tracked!" });
}
