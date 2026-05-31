import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { stripe, PLANS } from "@/lib/stripe";
import prisma from "@/lib/prisma";

// POST /api/checkout — create Stripe checkout session
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { plan } = await req.json();
  const planConfig = PLANS[plan as keyof typeof PLANS];
  if (!planConfig) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const baseUrl = process.env.NEXTAUTH_URL || "https://app.nguyenduchoa.com";

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    customer_email: user.email || undefined,
    metadata: {
      userId: user.id,
      plan,
    },
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `Auto Flow Pro — ${planConfig.name}`,
            description: "Bulk automation for Google Flow (Veo 3.1 & Nano Banana)",
          },
          unit_amount: planConfig.price,
          recurring: { interval: planConfig.interval },
        },
        quantity: 1,
      },
    ],
    subscription_data: {
      trial_period_days: planConfig.trialDays,
      metadata: { userId: user.id },
    },
    success_url: `${baseUrl}/dashboard?checkout=success`,
    cancel_url: `${baseUrl}/dashboard?checkout=cancel`,
  });

  return NextResponse.json({ url: checkoutSession.url });
}
