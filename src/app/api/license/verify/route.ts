import { NextRequest, NextResponse } from "next/server";
import { verifyLicense } from "@/lib/license";
import prisma from "@/lib/prisma";

// POST /api/license/verify
// Called by Chrome extension on every session
export async function POST(req: NextRequest) {
  try {
    const { licenseKey, deviceId } = await req.json();

    if (!licenseKey) {
      return NextResponse.json(
        { valid: false, message: "License key required" },
        { status: 400 }
      );
    }

    const ipAddress =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("x-real-ip") ||
      undefined;

    const result = await verifyLicense(licenseKey, deviceId, ipAddress);

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: "license.verify",
        details: JSON.stringify({
          key: licenseKey.slice(0, 8) + "...",
          deviceId: deviceId?.slice(0, 8),
          result: result.status,
        }),
        ipAddress: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown",
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("License verify error:", error);
    return NextResponse.json(
      { valid: false, message: "Internal error" },
      { status: 500 }
    );
  }
}
