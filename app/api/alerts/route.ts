import { z } from "zod";
import { getDb } from "@/lib/db";
import { fail, json } from "@/lib/http";
import { acknowledgeAlert, acknowledgeAll, listAlerts } from "@/lib/repo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET() {
  try {
    return json({ alerts: listAlerts(getDb()) });
  } catch (error) {
    return fail(error);
  }
}

const bodySchema = z.object({
  id: z.number().int().positive().optional(),
  all: z.boolean().optional(),
});

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json());
    const db = getDb();
    if (body.all) acknowledgeAll(db);
    else if (body.id) acknowledgeAlert(db, body.id);
    else return json({ error: "Provide an alert id or all: true" }, 400);
    return json({ alerts: listAlerts(db) });
  } catch (error) {
    return fail(error, error instanceof z.ZodError ? 400 : 500);
  }
}
