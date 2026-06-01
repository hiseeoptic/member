import prisma from "@/lib/prisma";

export interface LicenseVerifyResult {
  valid: boolean;
  status: string;
  plan?: string;
  expiresAt?: string;
  message: string;
}

export async function verifyLicense(
  licenseKey: string,
  deviceId?: string,
  ipAddress?: string
): Promise<LicenseVerifyResult> {
  const license = await prisma.licenseKey.findUnique({
    where: { key: licenseKey },
    include: {
      user: {
        include: { subscription: true },
      },
    },
  });

  if (!license) {
    return { valid: false, status: "NOT_FOUND", message: "License key not found" };
  }

  if (license.status === "REVOKED") {
    return { valid: false, status: "REVOKED", message: "License has been revoked" };
  }

  const sub = license.user.subscription;
  if (!sub) {
    return { valid: false, status: "NO_SUBSCRIPTION", message: "No active subscription" };
  }

  // Check subscription status
  if (sub.status === "EXPIRED" || sub.status === "CANCELLED") {
    return {
      valid: false,
      status: sub.status,
      message: sub.status === "EXPIRED" ? "Subscription expired" : "Subscription cancelled",
    };
  }

  // Check trial expiry
  if (sub.status === "TRIAL" && sub.trialEndsAt && new Date() > sub.trialEndsAt) {
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { status: "EXPIRED" },
    });
    await prisma.licenseKey.update({
      where: { id: license.id },
      data: { status: "EXPIRED" },
    });
    return { valid: false, status: "TRIAL_EXPIRED", message: "Trial period has ended" };
  }

  // Check period end for active subscriptions
  if (sub.status === "ACTIVE" && sub.currentPeriodEnd && new Date() > sub.currentPeriodEnd) {
    return { valid: false, status: "PAST_DUE", message: "Payment overdue" };
  }

  // ===== TRIAL ABUSE PREVENTION =====
  // One device may consume only ONE free trial. Paid users are never blocked.
  if (sub.status === "TRIAL" && deviceId) {
    const claim = await prisma.trialClaim.findUnique({ where: { deviceId } });

    if (!claim) {
      // First trial ever on this device — claim it for this user.
      await prisma.trialClaim.create({
        data: { deviceId, userId: license.userId, ipAddress: ipAddress || null },
      });
    } else if (claim.userId !== license.userId) {
      // A different account already used a free trial on this device.
      await prisma.auditLog.create({
        data: {
          userId: license.userId,
          action: "license.trial_abuse_blocked",
          details: `Device ${deviceId} already claimed by user ${claim.userId}`,
          ipAddress: ipAddress || null,
        },
      });
      return {
        valid: false,
        status: "DEVICE_TRIAL_USED",
        message:
          "Thiết bị này đã dùng thử miễn phí rồi. Vui lòng nâng cấp Pro để tiếp tục. / This device has already used a free trial — please upgrade to Pro.",
      };
    } else {
      // Same user, same device — refresh last-seen + IP.
      await prisma.trialClaim.update({
        where: { deviceId },
        data: { ipAddress: ipAddress || claim.ipAddress, lastSeenAt: new Date() },
      });
    }
  }

  // Bind device on first use (optional: restrict to 1 device)
  if (deviceId && !license.deviceId) {
    await prisma.licenseKey.update({
      where: { id: license.id },
      data: { deviceId, lastVerified: new Date() },
    });
  } else if (deviceId && license.deviceId && license.deviceId !== deviceId) {
    // Different device — allow but log it
    await prisma.auditLog.create({
      data: {
        userId: license.userId,
        action: "license.device_mismatch",
        details: `Registered: ${license.deviceId}, Attempted: ${deviceId}`,
      },
    });
    // For now, still allow (can restrict later)
  }

  // Update last verified
  await prisma.licenseKey.update({
    where: { id: license.id },
    data: { lastVerified: new Date() },
  });

  const daysLeft = sub.trialEndsAt
    ? Math.max(0, Math.ceil((sub.trialEndsAt.getTime() - Date.now()) / 86400000))
    : sub.currentPeriodEnd
    ? Math.max(0, Math.ceil((sub.currentPeriodEnd.getTime() - Date.now()) / 86400000))
    : 0;

  return {
    valid: true,
    status: sub.status,
    plan: sub.plan,
    expiresAt: (sub.trialEndsAt || sub.currentPeriodEnd)?.toISOString(),
    message:
      sub.status === "TRIAL"
        ? `Trial active — ${daysLeft} days remaining`
        : `${sub.plan} subscription active`,
  };
}
