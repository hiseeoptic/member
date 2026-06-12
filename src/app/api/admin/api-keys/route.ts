import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { generateApiKey, hashApiKey } from "@/lib/tokens";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (user?.role !== "ADMIN") return null;
  return user;
}

// GET /api/admin/api-keys — list all service API keys
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const keys = await prisma.serviceApiKey.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, appId: true, isActive: true, createdAt: true, lastUsed: true },
  });

  return NextResponse.json({ keys });
}

// POST /api/admin/api-keys — create a new service API key
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { name, appId } = await req.json();
  if (!name || !appId) {
    return NextResponse.json({ error: "name and appId required" }, { status: 400 });
  }

  const rawKey = generateApiKey(appId);
  const keyHash = hashApiKey(rawKey);

  await prisma.serviceApiKey.create({
    data: { name, appId, keyHash },
  });

  return NextResponse.json({ key: rawKey, message: "Save this key — it won't be shown again." });
}

// PATCH /api/admin/api-keys — toggle active state
export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id, isActive } = await req.json();
  if (!id || isActive === undefined) {
    return NextResponse.json({ error: "id and isActive required" }, { status: 400 });
  }

  await prisma.serviceApiKey.update({ where: { id }, data: { isActive } });
  return NextResponse.json({ ok: true });
}
