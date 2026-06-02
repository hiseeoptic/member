import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Free generations a visitor can run before signing up (per device).
const DEMO_LIMIT = 5;

// POST /api/demo/consume
// Body: { deviceId: string, count?: number }
//   count = 0  -> just check remaining quota (no consumption)
//   count > 0  -> try to consume `count` generations
// Returns: { allowed, remaining, limit, used }
export async function POST(req: NextRequest) {
  try {
    const { deviceId, count = 0 } = await req.json();

    if (!deviceId || typeof deviceId !== "string") {
      return NextResponse.json(
        { allowed: false, error: "deviceId required" },
        { status: 400 }
      );
    }

    const ipAddress =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("x-real-ip") ||
      null;

    const want = Math.max(0, Math.min(Number(count) || 0, DEMO_LIMIT));

    const existing = await prisma.demoUsage.findUnique({ where: { deviceId } });
    const used = existing?.used ?? 0;
    const remaining = Math.max(0, DEMO_LIMIT - used);

    // Status-only check
    if (want === 0) {
      return NextResponse.json({
        allowed: remaining > 0,
        remaining,
        limit: DEMO_LIMIT,
        used,
      });
    }

    // Not enough quota left
    if (want > remaining) {
      return NextResponse.json({
        allowed: false,
        remaining,
        limit: DEMO_LIMIT,
        used,
      });
    }

    const updated = await prisma.demoUsage.upsert({
      where: { deviceId },
      create: { deviceId, used: want, ipAddress },
      update: { used: { increment: want }, ipAddress },
    });

    return NextResponse.json({
      allowed: true,
      remaining: Math.max(0, DEMO_LIMIT - updated.used),
      limit: DEMO_LIMIT,
      used: updated.used,
    });
  } catch (err) {
    console.error("demo/consume error:", err);
    return NextResponse.json(
      { allowed: false, error: "Internal error" },
      { status: 500 }
    );
  }
}
