import { z } from "zod";
import { getDb } from "@/lib/db";
import { fail, json } from "@/lib/http";
import { testDeyeConnection } from "@/lib/sync";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({
  region: z.enum(["eu", "us", "india", "custom"]).optional(),
  baseUrl: z.string().max(200).optional(),
  appId: z.string().max(120).optional(),
  appSecret: z.string().max(200).optional(),
  email: z.string().max(200).optional(),
  password: z.string().max(200).optional(),
  companyId: z.string().max(40).optional(),
  stationId: z.string().max(40).optional(),
  deviceSn: z.string().max(64).optional(),
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const result = await testDeyeConnection(getDb(), {
      region: body.region,
      baseUrl: body.baseUrl,
      appId: body.appId,
      appSecret: body.appSecret,
      email: body.email,
      password: body.password,
      companyId: body.companyId,
      stationId: body.stationId,
      deviceSn: body.deviceSn,
    });
    return json(result, result.ok ? 200 : 400);
  } catch (error) {
    return fail(error, error instanceof z.ZodError ? 400 : 500);
  }
}
