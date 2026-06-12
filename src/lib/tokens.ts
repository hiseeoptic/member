// Token packages (gói mua)
export const TOKEN_PACKAGES = [
  { id: "starter",    name: "Starter",    usdCents: 500,  credits: 5_000,  bonus: 0,      popular: false },
  { id: "basic",      name: "Basic",      usdCents: 1000, credits: 10_000, bonus: 1_000,  popular: false },
  { id: "pro",        name: "Pro",        usdCents: 2500, credits: 25_000, bonus: 4_000,  popular: true  },
  { id: "enterprise", name: "Enterprise", usdCents: 5000, credits: 50_000, bonus: 12_500, popular: false },
] as const;

export type TokenPackageId = typeof TOKEN_PACKAGES[number]["id"];

// Model pricing (credits per 1k AI-tokens, ~2.5x markup)
// 1 credit = $0.001, real prices × 2.5 converted to credits
export const MODEL_PRICING: Record<string, {
  name: string;
  provider: "google" | "openai" | "anthropic";
  inputPer1k: number;   // credits per 1k input tokens
  outputPer1k: number;  // credits per 1k output tokens
  description: string;
  badge?: string;
}> = {
  "gemini-2.0-flash": {
    name: "Gemini 2.0 Flash",
    provider: "google",
    inputPer1k: 0.19,
    outputPer1k: 0.75,
    description: "Nhanh, tiết kiệm, phù hợp hầu hết tác vụ",
    badge: "Phổ biến",
  },
  "gemini-1.5-pro": {
    name: "Gemini 1.5 Pro",
    provider: "google",
    inputPer1k: 3.13,
    outputPer1k: 12.5,
    description: "Context 2M tokens, phân tích tài liệu dài",
  },
  "gpt-4o-mini": {
    name: "GPT-4o Mini",
    provider: "openai",
    inputPer1k: 0.38,
    outputPer1k: 1.5,
    description: "Nhanh và thông minh từ OpenAI",
    badge: "Tiết kiệm",
  },
  "gpt-4o": {
    name: "GPT-4o",
    provider: "openai",
    inputPer1k: 6.25,
    outputPer1k: 25.0,
    description: "Flagship model của OpenAI",
  },
  "claude-haiku-4-5": {
    name: "Claude Haiku 4.5",
    provider: "anthropic",
    inputPer1k: 2.0,
    outputPer1k: 10.0,
    description: "Nhanh nhất trong dòng Claude",
  },
  "claude-sonnet-4-6": {
    name: "Claude Sonnet 4.6",
    provider: "anthropic",
    inputPer1k: 7.5,
    outputPer1k: 37.5,
    description: "Cân bằng tốt nhất: thông minh + tốc độ",
    badge: "Mới",
  },
  "claude-opus-4-8": {
    name: "Claude Opus 4.8",
    provider: "anthropic",
    inputPer1k: 37.5,
    outputPer1k: 187.5,
    description: "Mạnh nhất Anthropic, cho tác vụ phức tạp",
  },
};

// Calculate credits cost for an API call
export function calculateCreditCost(
  modelId: string,
  inputTokens: number,
  outputTokens: number
): number {
  const model = MODEL_PRICING[modelId];
  if (!model) return 0;
  const cost =
    (inputTokens / 1000) * model.inputPer1k +
    (outputTokens / 1000) * model.outputPer1k;
  return Math.ceil(cost); // always round up
}

import type { PrismaClient } from "@/generated/prisma/client";

// Get or create TokenBalance for a user
export async function getOrCreateBalance(userId: string, prisma: PrismaClient) {
  const existing = await prisma.tokenBalance.findUnique({ where: { userId } });
  if (existing) return existing;
  return prisma.tokenBalance.create({ data: { userId, balance: 0 } });
}

// Add credits (purchase or bonus)
export async function addCredits(
  userId: string,
  amount: number,
  type: "PURCHASE" | "BONUS" | "AFFILIATE" | "REFUND",
  opts: { description?: string; refId?: string },
  prisma: PrismaClient
) {
  const balance = await getOrCreateBalance(userId, prisma);
  const newBalance = balance.balance + amount;

  await prisma.$transaction([
    prisma.tokenBalance.update({
      where: { userId },
      data: { balance: { increment: amount } },
    }),
    prisma.tokenTransaction.create({
      data: {
        userId,
        amount,
        balanceAfter: newBalance,
        type,
        description: opts.description,
        refId: opts.refId,
      },
    }),
  ]);

  return newBalance;
}

// Deduct credits (usage)
export async function deductCredits(
  userId: string,
  amount: number,
  opts: { modelId: string; appId: string; description?: string },
  prisma: PrismaClient
): Promise<{ success: boolean; balanceAfter: number; error?: string }> {
  const balance = await getOrCreateBalance(userId, prisma);

  if (balance.balance < amount) {
    return { success: false, balanceAfter: balance.balance, error: "Insufficient credits" };
  }

  const newBalance = balance.balance - amount;

  await prisma.$transaction([
    prisma.tokenBalance.update({
      where: { userId },
      data: { balance: { decrement: amount } },
    }),
    prisma.tokenTransaction.create({
      data: {
        userId,
        amount: -amount,
        balanceAfter: newBalance,
        type: "USAGE",
        modelId: opts.modelId,
        appId: opts.appId,
        description: opts.description,
      },
    }),
  ]);

  return { success: true, balanceAfter: newBalance };
}

// Hash API key for storage (SHA-256)
import { createHash } from "node:crypto";
export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

// Generate a new service API key
export function generateApiKey(appId: string): string {
  const random = createHash("sha256")
    .update(`${appId}-${Date.now()}-${Math.random()}`)
    .digest("hex")
    .slice(0, 32);
  return `ndk_${appId}_${random}`;
}
