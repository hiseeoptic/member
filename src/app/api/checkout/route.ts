import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { stripe, PLANS, ONE_TIME_PRODUCTS } from "@/lib/stripe";
import prisma from "@/lib/prisma";

// POST /api/checkout — create Stripe checkout session
// Supports:
//   { plan: "MONTHLY" | "YEARLY" }              → subscription
//   { product: "ai-marketing-course", mode: "one-time" }  → one-time payment from shop
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const baseUrl = process.env.NEXTAUTH_URL || "https://member.nguyenduchoa.com";
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // ── One-time product purchase ──────────────────────────────────────────────
  if (body.mode === "one-time" && body.product) {
    const product = ONE_TIME_PRODUCTS[body.product as string];
    if (!product) {
      return NextResponse.json({ error: "Invalid product" }, { status: 400 });
    }

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: user.email || undefined,
      metadata: { userId: user.id, product: body.product, type: "one-time" },
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: product.name, description: product.description },
            unit_amount: product.price,
          },
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/dashboard?checkout=success&product=${body.product}`,
      cancel_url: `${baseUrl}/dashboard?checkout=cancel`,
    });

    return NextResponse.json({ url: checkoutSession.url });
  }

  // ── Subscription plan ──────────────────────────────────────────────────────
  const planConfig = PLANS[body.plan as keyof typeof PLANS];
  if (!planConfig) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    customer_email: user.email || undefined,
    metadata: { userId: user.id, plan: body.plan },
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `Nguyễn Đức Hoa — ${planConfig.name}`,
            description: "Toàn bộ hệ sinh thái AI: FlowVeo, ThansOhoc, AI Studio, VinaLink và nhiều hơn nữa",
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
