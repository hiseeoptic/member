import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { v4 as uuidv4 } from "uuid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TRIAL_DAYS = 7;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function genLicenseKey() {
  return `AF-${uuidv4().split("-").slice(0, 3).join("-").toUpperCase()}`;
}

// POST /api/trial/claim
// Body: { email, deviceId }
// Instantly issues a 7-day trial license for the given email (NO email
// verification). Abuse is limited by: (1) email uniqueness — one email can
// only claim once; (2) deviceId — one device can only claim one trial.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase();
    const deviceId = String(body.deviceId || "").trim();

    if (!EMAIL_RE.test(email)) {
      return NextResponse.json(
        { ok: false, status: "INVALID_EMAIL", message: "Email không hợp lệ. / Invalid email." },
        { status: 400 }
      );
    }
    if (!deviceId) {
      return NextResponse.json(
        { ok: false, status: "NO_DEVICE", message: "Thiếu mã thiết bị. / Missing device id." },
        { status: 400 }
      );
    }

    const ipAddress =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("x-real-ip") ||
      null;

    // ---- 1. Email already known? ----
    const existing = await prisma.user.findUnique({
      where: { email },
      include: { subscription: true, licenseKeys: { take: 1, orderBy: { createdAt: "desc" } } },
    });

    if (existing) {
      const sub = existing.subscription;
      const key = existing.licenseKeys[0]?.key;

      // Paid / active subscription → just hand back their license to use.
      if (sub && sub.status === "ACTIVE") {
        return NextResponse.json({
          ok: true,
          status: "ACTIVE",
          licenseKey: key,
          message: "Tài khoản Pro đang hoạt động. / Pro account active.",
        });
      }

      // Trial still valid → resume it (return same key).
      if (sub && sub.status === "TRIAL" && sub.trialEndsAt && new Date() < sub.trialEndsAt) {
        const daysLeft = Math.max(
          0,
          Math.ceil((sub.trialEndsAt.getTime() - Date.now()) / 86400000)
        );
        return NextResponse.json({
          ok: true,
          status: "TRIAL",
          licenseKey: key,
          expiresAt: sub.trialEndsAt.toISOString(),
          message: `Tiếp tục dùng thử — còn ${daysLeft} ngày. / Trial resumed — ${daysLeft} days left.`,
        });
      }

      // Email exists but trial expired / cancelled → already used.
      return NextResponse.json(
        {
          ok: false,
          status: "EMAIL_TRIAL_USED",
          message:
            "Email này đã dùng thử miễn phí rồi. Vui lòng nâng cấp Pro để tiếp tục. / This email already used its free trial — please upgrade.",
        },
        { status: 409 }
      );
    }

    // ---- 2. New email — check the device hasn't already burned a trial ----
    const claim = await prisma.trialClaim.findUnique({ where: { deviceId } });
    if (claim) {
      await prisma.auditLog.create({
        data: {
          userId: claim.userId,
          action: "trial.device_reuse_blocked",
          details: `Device ${deviceId} already claimed; new email ${email} blocked`,
          ipAddress,
        },
      });
      return NextResponse.json(
        {
          ok: false,
          status: "DEVICE_TRIAL_USED",
          message:
            "Thiết bị này đã dùng thử miễn phí rồi. Vui lòng nâng cấp Pro để tiếp tục. / This device has already used a free trial — please upgrade.",
        },
        { status: 409 }
      );
    }

    // ---- 3. Create user + 7-day trial + license + referral + device claim ----
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + TRIAL_DAYS);
    const licenseKey = genLicenseKey();
    const namePart = email.split("@")[0].replace(/[^a-zA-Z0-9]/g, "").slice(0, 6).toUpperCase() || "USER";
    const refCode = `${namePart}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    const user = await prisma.user.create({
      data: {
        email,
        subscription: {
          create: {
            status: "TRIAL",
            plan: "MONTHLY",
            trialEndsAt: trialEnd,
            currentPeriodStart: new Date(),
            currentPeriodEnd: trialEnd,
          },
        },
        licenseKeys: {
          create: { key: licenseKey, status: "ACTIVE", expiresAt: trialEnd },
        },
        referralCode: { create: { code: refCode } },
      },
    });

    await prisma.trialClaim.create({
      data: { deviceId, userId: user.id, ipAddress },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "trial.email_claim",
        details: `Email trial (${TRIAL_DAYS}d) for ${email}, device ${deviceId}`,
        ipAddress,
      },
    });

    return NextResponse.json({
      ok: true,
      status: "TRIAL",
      licenseKey,
      expiresAt: trialEnd.toISOString(),
      message: `Đã kích hoạt dùng thử ${TRIAL_DAYS} ngày! / ${TRIAL_DAYS}-day trial activated!`,
    });
  } catch (err) {
    console.error("trial/claim error:", err);
    return NextResponse.json(
      { ok: false, status: "ERROR", message: "Lỗi hệ thống. Thử lại sau. / Server error." },
      { status: 500 }
    );
  }
}
