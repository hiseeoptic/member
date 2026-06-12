import { NextResponse } from "next/server";
import { TOKEN_PACKAGES, MODEL_PRICING } from "@/lib/tokens";

export async function GET() {
  return NextResponse.json({ packages: TOKEN_PACKAGES, models: MODEL_PRICING });
}
