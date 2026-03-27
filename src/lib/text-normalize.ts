const MOJIBAKE_MARKERS = ["Ã", "â€", "â€“", "â€”", "Â", "�"];

function looksMojibake(value: string) {
  return MOJIBAKE_MARKERS.some((m) => value.includes(m));
}

export function fixMojibake(value: unknown): string {
  const input = String(value ?? "");
  if (!input) return "";
  if (!looksMojibake(input)) return input;

  try {
    const bytes = Uint8Array.from([...input].map((c) => c.charCodeAt(0) & 0xff));
    const decoded = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    return decoded || input;
  } catch {
    return input;
  }
}

export function sanitizeText(value: unknown, fallback = ""): string {
  const fixed = fixMojibake(value);
  const trimmed = fixed.trim();
  return trimmed || fallback;
}

export function sanitizeNullableText(value: unknown): string | undefined {
  const fixed = fixMojibake(value);
  const trimmed = fixed.trim();
  return trimmed ? trimmed : undefined;
}
