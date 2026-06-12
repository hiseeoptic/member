import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { TOKEN_PACKAGES } from "@/lib/tokens";
import prisma from "@/lib/prisma";

// POST /api/tokens/purchase — create Stripe checkout for credit top-up
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { packageId } = await req.json();
  const pkg = TOKEN_PACKAGES.find((p) => p.id === packageId);
  if (!pkg) {
    return NextResponse.json({ error: "Invalid package" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const baseUrl = process.env.NEXTAUTH_URL || "https://member.nguyenduchoa.com";
  const totalCredits = pkg.credits + pkg.bonus;

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    customer_email: user.email || undefined,
    metadata: {
      userId: user.id,
      type: "token_purchase",
      packageId: pkg.id,
    },
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `${pkg.name} — ${totalCredits.toLocaleString()} Credits`,
            description: pkg.bonus > 0
              ? `${pkg.credits.toLocaleString()} credits + ${pkg.bonus.toLocaleString()} bonus`
              : `${pkg.credits.toLocaleString()} credits`,
          },
          unit_amount: pkg.usdCents,
        },
        quantity: 1,
      },
    ],
    success_url: `${baseUrl}/tokens?purchase=success`,
    cancel_url: `${baseUrl}/tokens`,
  });

  return NextResponse.json({ url: checkoutSession.url });
}
