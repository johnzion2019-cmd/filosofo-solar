import { NextResponse } from "next/server";
import { buildEarningsCsv, csvFilename } from "@/lib/csv-report";
import { getDb } from "@/lib/db";
import { fail } from "@/lib/http";
import { buildDashboard } from "@/lib/status";
import { zonedParts } from "@/lib/time";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const data = await buildDashboard(getDb());
    const ymd = zonedParts(Date.now(), data.plant.timeZone).ymd;
    const body = buildEarningsCsv(data.earnings);
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${csvFilename(ymd)}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return fail(error);
  }
}
