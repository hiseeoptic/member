import { NextResponse } from "next/server";
import { MODEL_PRICING } from "@/lib/tokens";

// GET /api/tokens/models — public list of supported AI models + credit pricing
export async function GET() {
  return NextResponse.json({ models: MODEL_PRICING });
}
