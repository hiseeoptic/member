import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import prisma from "@/lib/prisma";
import { addCredits, TOKEN_PACKAGES } from "@/lib/tokens";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature")!;

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const userId = session.metadata?.userId;
      if (!userId) break;

      // ── Token purchase (one-time credit top-up) ──────────────────────────
      if (session.metadata?.type === "token_purchase") {
        const packageId = session.metadata?.packageId;
        const pkg = TOKEN_PACKAGES.find((p) => p.id === packageId);
        if (pkg) {
          const totalCredits = pkg.credits + pkg.bonus;
          await addCredits(
            userId,
            totalCredits,
            "PURCHASE",
            { description: `Mua gói ${pkg.name} (${pkg.credits.toLocaleString()} + ${pkg.bonus.toLocaleString()} bonus)`, refId: session.id },
            prisma
          );
          await prisma.auditLog.create({
            data: { userId, action: "token.purchased", details: `Package: ${pkg.name}, Credits: ${totalCredits}` },
          });
        }
        break;
      }

      await prisma.subscription.update({
        where: { userId },
        data: {
          status: "ACTIVE",
          stripeCustomerId: session.customer as string,
          stripeSubscriptionId: session.subscription as string,
          paymentMethod: "STRIPE",
        },
      });

      // Extend license key
      await prisma.licenseKey.updateMany({
        where: { userId, status: "ACTIVE" },
        data: { expiresAt: null }, // No expiry for active subscription
      });

      // If referred, activate the referral
      await prisma.referral.updateMany({
        where: { referredUserId: userId, status: "PENDING" },
        data: { status: "ACTIVE" },
      });

      await prisma.auditLog.create({
        data: { userId, action: "subscription.activated", details: `Plan: ${session.metadata?.plan}` },
      });
      break;
    }

    case "invoice.paid": {
      const invoice = event.data.object as unknown as Record<string, unknown>;
      const subId = (invoice.subscription as string) || "";

      const sub = await prisma.subscription.findUnique({
        where: { stripeSubscriptionId: subId },
      });
      if (!sub) break;

      // Update period
      await prisma.subscription.update({
        where: { id: sub.id },
        data: {
          status: "ACTIVE",
          currentPeriodStart: new Date(((invoice.period_start as number) || 0) * 1000),
          currentPeriodEnd: new Date(((invoice.period_end as number) || 0) * 1000),
        },
      });

      // Calculate affiliate commission
      const referral = await prisma.referral.findUnique({
        where: { referredUserId: sub.userId },
      });
      if (referral && referral.status === "ACTIVE") {
        const amount = ((invoice.amount_paid as number) || 0) / 100; // cents to dollars
        const commission = amount * referral.commissionRate;

        await prisma.commission.create({
          data: {
            referralId: referral.id,
            amount: commission,
            sourceAmount: amount,
            period: new Date().toISOString().slice(0, 7),
            status: "APPROVED",
          },
        });

        await prisma.referral.update({
          where: { id: referral.id },
          data: { totalEarned: { increment: commission } },
        });
      }

      await prisma.auditLog.create({
        data: {
          userId: sub.userId,
          action: "invoice.paid",
          details: `Amount: $${((invoice.amount_paid as number) || 0) / 100}`,
        },
      });
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object;
      const sub = await prisma.subscription.findUnique({
        where: { stripeSubscriptionId: subscription.id },
      });
      if (!sub) break;

      await prisma.subscription.update({
        where: { id: sub.id },
        data: { status: "CANCELLED", cancelAt: new Date() },
      });

      // Expire license
      await prisma.licenseKey.updateMany({
        where: { userId: sub.userId, status: "ACTIVE" },
        data: { status: "EXPIRED" },
      });

      // Deactivate referral
      await prisma.referral.updateMany({
        where: { referredUserId: sub.userId, status: "ACTIVE" },
        data: { status: "CANCELLED" },
      });

      await prisma.auditLog.create({
        data: { userId: sub.userId, action: "subscription.cancelled" },
      });
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as unknown as Record<string, unknown>;
      const subId = (invoice.subscription as string) || "";
      await prisma.subscription.updateMany({
        where: { stripeSubscriptionId: subId },
        data: { status: "PAST_DUE" },
      });
      break;
    }
  }

  return NextResponse.json({ received: true });
}
