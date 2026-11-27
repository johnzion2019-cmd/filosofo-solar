import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import fs from "fs";
import path from "path";

const PREFIX = "enc:v1:";

function material(): string {
  if (process.env.SETTINGS_SECRET && process.env.SETTINGS_SECRET.trim()) {
    return process.env.SETTINGS_SECRET.trim();
  }
  const dir = path.dirname(process.env.DATABASE_PATH || path.join(process.cwd(), "data", "filosofo.sqlite"));
  const file = path.join(dir, ".settings-key");
  if (fs.existsSync(file)) return fs.readFileSync(file, "utf8").trim();
  fs.mkdirSync(dir, { recursive: true });
  const created = randomBytes(32).toString("hex");
  fs.writeFileSync(file, created, { mode: 0o600 });
  return created;
}

const keyCache = new Map<string, Buffer>();

function key(): Buffer {
  const secret = material();
  const cached = keyCache.get(secret);
  if (cached) return cached;
  const derived = scryptSync(secret, "filosofo-settings", 32);
  keyCache.set(secret, derived);
  return derived;
}

export function encryptSecret(plain: string): string {
  if (!plain) return "";
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, ciphertext]).toString("base64");
}

export function decryptSecret(stored: string | null | undefined): string {
  if (!stored) return "";
  if (!stored.startsWith(PREFIX)) return stored;
  const raw = Buffer.from(stored.slice(PREFIX.length), "base64");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const ciphertext = raw.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) {
    timingSafeEqual(left, left);
    return false;
  }
  return timingSafeEqual(left, right);
}

export function hashDeyePassword(password: string): string {
  return createHash("sha256").update(password, "utf8").digest("hex");
}

/** Deye expects a lowercase SHA-256 hex digest. A digest pasted by hand is sent as-is. */
export function deyePasswordField(password: string): string {
  const trimmed = password.trim();
  if (/^[a-f0-9]{64}$/i.test(trimmed)) return trimmed.toLowerCase();
  return hashDeyePassword(trimmed);
}

export function newIngestKey(): string {
  return randomBytes(24).toString("hex");
}
