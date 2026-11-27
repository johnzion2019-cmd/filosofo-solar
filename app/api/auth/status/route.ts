import { json } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET() {
  return json({ required: Boolean(process.env.APP_PIN) });
}
