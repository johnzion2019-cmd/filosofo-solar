import { getDb } from "@/lib/db";
import { fail, json } from "@/lib/http";
import { clearHousePhoto, resolveHousePhoto, saveHousePhoto } from "@/lib/house-photo";
import fs from "fs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET() {
  try {
    const photo = resolveHousePhoto();
    const body = fs.readFileSync(photo.file);
    return new Response(body, {
      headers: {
        "Content-Type": photo.type,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("photo");
    if (!(file instanceof File)) return json({ error: "Choose a house photo" }, 400);
    if (file.size > 8_000_000) return json({ error: "Photo must be under 8 MB" }, 400);
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      return json({ error: "Use a JPEG, PNG, or WebP photo" }, 400);
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    saveHousePhoto(getDb(), bytes, file.type);
    return json({ ok: true });
  } catch (error) {
    return fail(error, 400);
  }
}

export function DELETE() {
  try {
    clearHousePhoto(getDb());
    return json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}
