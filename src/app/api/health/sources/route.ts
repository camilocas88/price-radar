import { NextResponse } from "next/server";
import { runSourceHealthChecks } from "@/lib/source-health";

export const dynamic = "force-dynamic";

export async function GET() {
  const sources = await runSourceHealthChecks();
  return NextResponse.json({ checkedAt: new Date().toISOString(), sources });
}
