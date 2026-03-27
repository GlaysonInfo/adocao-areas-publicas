// src/lib/text.ts

const MOJIBAKE_MARKERS = ["Ã", "â€", "â€“", "â€”", "Â", "�"];

function looksMojibake(value: string) {
  return MOJIBAKE_MARKERS.some((m) => value.includes(m));
}

/**
 * Tenta corrigir textos UTF-8 lidos como Latin-1/Windows-1252.
 * Ex.: "CÃ³digo" -> "Código", "Ã�rea" -> "Área", "â€”" -> "—".
 */
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

/**
 * Normaliza texto para exibição na UI.
 * - corrige mojibake quando detectado
 * - retorna fallback amigável quando vazio
 */
export function displayText(value: unknown, fallback = "—"): string {
  const fixed = fixMojibake(value);
  const trimmed = fixed.trim();
  return trimmed ? trimmed : fallback;
}
