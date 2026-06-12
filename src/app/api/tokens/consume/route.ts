import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { deductCredits, calculateCreditCost, hashApiKey } from "@/lib/tokens";

// POST /api/tokens/consume — service-to-service credit deduction
// Authorization: Bearer ndk_<appId>_<key>
// Body: { userId, modelId, inputTokens, outputTokens, description? }
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("Authorization") || "";
  const rawKey = authHeader.replace("Bearer ", "").trim();

  if (!rawKey.startsWith("ndk_")) {
    return NextResponse.json({ error: "Invalid API key format" }, { status: 401 });
  }

  const keyHash = hashApiKey(rawKey);
  const apiKey = await prisma.serviceApiKey.findUnique({ where: { keyHash } });

  if (!apiKey || !apiKey.isActive) {
    return NextResponse.json({ error: "Invalid or inactive API key" }, { status: 401 });
  }

  // Update lastUsed (non-blocking)
  prisma.serviceApiKey.update({
    where: { id: apiKey.id },
    data: { lastUsed: new Date() },
  }).catch(() => {});

  const body = await req.json();
  const { userId, modelId, inputTokens, outputTokens, description } = body;

  if (!userId || !modelId) {
    return NextResponse.json({ error: "userId and modelId required" }, { status: 400 });
  }

  const credits = calculateCreditCost(
    modelId,
    Number(inputTokens) || 0,
    Number(outputTokens) || 0
  );

  if (credits === 0) {
    return NextResponse.json({ error: "Unknown model or zero cost" }, { status: 400 });
  }

  const result = await deductCredits(
    userId,
    credits,
    { modelId, appId: apiKey.appId, description },
    prisma
  );

  if (!result.success) {
    return NextResponse.json(
      { error: "Insufficient credits", balanceAfter: result.balanceAfter },
      { status: 402 }
    );
  }

  return NextResponse.json({ ok: true, creditsDeducted: credits, balanceAfter: result.balanceAfter });
}
