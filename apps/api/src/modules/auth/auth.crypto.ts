// apps/api/src/modules/auth/auth.crypto.ts

import crypto from "node:crypto";

export function sha256_base64url(input: string): string {
  return crypto.createHash("sha256").update(input, "utf8").digest("base64url");
}

export function random_token_base64url(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

export function normalize_email(email: string): string {
  return email.trim().toLowerCase();
}

export function now_plus_minutes(minutes: number): Date {
  return new Date(Date.now() + minutes * 60_000);
}

export function now_plus_days(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60_000);
}