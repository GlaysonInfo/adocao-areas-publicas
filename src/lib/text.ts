// src/lib/text.ts
import { fixMojibake } from "./text-normalize";

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
