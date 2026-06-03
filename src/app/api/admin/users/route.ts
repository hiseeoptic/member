import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET /api/admin/users — list all users with subscription & affiliate info
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  if (admin?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "50");
  const search = searchParams.get("search") || "";
  const statusFilter = searchParams.get("status") || "";

  const where: Record<string, unknown> = {};
  if (search) {
    where.OR = [
      { email: { contains: search, mode: "insensitive" } },
      { name: { contains: search, mode: "insensitive" } },
    ];
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        trialEmail: true,
        image: true,
        role: true,
        createdAt: true,
        usdtWallet: true,
        subscription: {
          select: {
            status: true,
            plan: true,
            paymentMethod: true,
            trialEndsAt: true,
            currentPeriodEnd: true,
          },
        },
        licenseKeys: {
          where: { status: "ACTIVE" },
          select: { key: true, deviceId: true, lastVerified: true },
          take: 1,
        },
        referralCode: {
          select: { code: true, clicks: true },
        },
        referrals: {
          select: { id: true, status: true, totalEarned: true },
        },
        // Who referred THIS user (their upline affiliate)
        referredBy: {
          select: {
            status: true,
            referralCode: { select: { code: true } },
            referrer: { select: { name: true, email: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  // Optionally filter by subscription status
  let filtered = users;
  if (statusFilter) {
    filtered = users.filter(
      (u) => u.subscription?.status === statusFilter
    );
  }

  return NextResponse.json({
    users: filtered.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email || u.trialEmail, // trial users have no Google email
      image: u.image,
      role: u.role,
      createdAt: u.createdAt.toISOString(),
      usdtWallet: u.usdtWallet,
      subscription: u.subscription
        ? {
            status: u.subscription.status,
            plan: u.subscription.plan,
            paymentMethod: u.subscription.paymentMethod,
            trialEndsAt: u.subscription.trialEndsAt?.toISOString() || null,
            currentPeriodEnd: u.subscription.currentPeriodEnd?.toISOString() || null,
          }
        : null,
      licenseKey: u.licenseKeys[0]?.key || null,
      referralCode: u.referralCode?.code || null,
      referralClicks: u.referralCode?.clicks || 0,
      totalReferrals: u.referrals.length,
      referralEarnings: u.referrals.reduce((s, r) => s + r.totalEarned, 0),
      referredBy: u.referredBy
        ? {
            name: u.referredBy.referrer?.name || null,
            email: u.referredBy.referrer?.email || null,
            code: u.referredBy.referralCode?.code || null,
            status: u.referredBy.status,
          }
        : null,
    })),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
}
