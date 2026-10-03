import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const [users, wallets, operations, branches] = await Promise.all([
      prisma.user.count(),
      prisma.wallet.count(),
      prisma.operation.count(),
      prisma.branch.count(),
    ]);

    return NextResponse.json({
      ok: true,
      database: "connected",
      counts: { users, wallets, operations, branches },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { ok: false, database: "error", message },
      { status: 500 },
    );
  }
}
