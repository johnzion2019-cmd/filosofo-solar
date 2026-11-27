import fs from "fs";
import path from "path";
import { databaseFile } from "@/lib/db";
import { setSetting, type AppDb } from "@/lib/repo";

const TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export function housePhotoDir(): string {
  return path.dirname(databaseFile());
}

export function resolveHousePhoto(): { file: string; type: string; custom: boolean } {
  const dir = housePhotoDir();
  for (const ext of Object.keys(TYPES)) {
    const file = path.join(dir, `house-photo.${ext}`);
    if (fs.existsSync(file)) return { file, type: TYPES[ext], custom: true };
  }
  return { file: path.join(process.cwd(), "public", "house-default.jpg"), type: "image/jpeg", custom: false };
}

export function saveHousePhoto(db: AppDb, bytes: Buffer, mime: string): void {
  const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
  const dir = housePhotoDir();
  fs.mkdirSync(dir, { recursive: true });
  for (const candidate of Object.keys(TYPES)) {
    const file = path.join(dir, `house-photo.${candidate}`);
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }
  fs.writeFileSync(path.join(dir, `house-photo.${ext}`), bytes);
  setSetting(db, "house_photo", "custom");
  setSetting(db, "house_photo_at", String(Date.now()));
}

export function clearHousePhoto(db: AppDb): void {
  const dir = housePhotoDir();
  for (const ext of Object.keys(TYPES)) {
    const file = path.join(dir, `house-photo.${ext}`);
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }
  setSetting(db, "house_photo", "");
}
