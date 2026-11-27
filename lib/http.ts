import { NextResponse } from "next/server";
import { errorMessage } from "@/lib/utils";

export function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export function fail(error: unknown, status = 500): NextResponse {
  return json({ error: errorMessage(error) }, status);
}
