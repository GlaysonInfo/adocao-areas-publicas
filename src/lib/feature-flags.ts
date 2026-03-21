// src/lib/feature-flags.ts

function parseBooleanEnv(value: unknown, fallback = false) {
  if (value == null) return fallback;
  const s = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on", "sim"].includes(s)) return true;
  if (["0", "false", "no", "off", "nao", "não"].includes(s)) return false;
  return fallback;
}

export function useHttpApiEnabled() {
  return parseBooleanEnv((import.meta as any)?.env?.VITE_USE_HTTP_API, false);
}
