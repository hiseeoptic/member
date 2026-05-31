import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { cookies } from "next/headers";

// Referral landing page — tracks click & stores code in cookie
export default async function ReferralPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  // Find referral code
  const referralCode = await prisma.referralCode.findUnique({
    where: { code: code.toUpperCase() },
  });

  if (referralCode) {
    // Increment click count
    await prisma.referralCode.update({
      where: { id: referralCode.id },
      data: { clicks: { increment: 1 } },
    });

    // Store in cookie for 30 days
    const cookieStore = await cookies();
    cookieStore.set("ref", referralCode.code, {
      maxAge: 30 * 24 * 60 * 60,
      httpOnly: true,
      secure: true,
      sameSite: "lax",
    });
  }

  // Redirect to login/signup
  redirect("/login?ref=" + code);
}
