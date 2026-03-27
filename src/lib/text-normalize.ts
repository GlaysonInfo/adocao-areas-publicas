const MOJIBAKE_MARKERS = ["Ã", "â€", "â€“", "â€”", "Â", "�"];

const COMMON_PT_BR_REPAIRS: Array<[RegExp, string]> = [
  [/\bPra�a\b/g, "Praça"],
  [/\bpra�a\b/g, "praça"],
  [/\bN�o\b/g, "Não"],
  [/\bn�o\b/g, "não"],
  [/\bJo�o\b/g, "João"],
  [/\bjo�o\b/g, "joão"],
  [/\bS�o\b/g, "São"],
  [/\bs�o\b/g, "são"],
  [/\bP�blica\b/g, "Pública"],
  [/\bp�blica\b/g, "pública"],
  [/\bP�blico\b/g, "Público"],
  [/\bp�blico\b/g, "público"],
  [/\bRegi�o\b/g, "Região"],
  [/\bregi�o\b/g, "região"],
  [/sinaliza��o/g, "sinalização"],
  [/Interven��es/g, "Intervenções"],
  [/interven��es/g, "intervenções"],
  [/circula��o/g, "circulação"],
  [/preserva��o/g, "preservação"],
  [/vegeta��o/g, "vegetação"],
  [/implanta��o/g, "implantação"],
  [/ilumina��o/g, "iluminação"],
  [/manuten��o/g, "manutenção"],
  [/vi�ria/g, "viária"],
  [/pr�tica/g, "prática"],
  [/pr�ximo/g, "próximo"],
  [/Pr�xima/g, "Próxima"],
  [/Jos�/g, "José"],
  [/Col�nia/g, "Colônia"],
  [/C�rrego/g, "Córrego"],
];

function looksMojibake(value: string) {
  return MOJIBAKE_MARKERS.some((marker) => value.includes(marker));
}

function scoreDecodedText(value: string) {
  const replacementChars = (value.match(/�/g) ?? []).length;
  const mojibakeHits = MOJIBAKE_MARKERS.reduce((acc, marker) => acc + (value.includes(marker) ? 1 : 0), 0);
  return replacementChars * 10 + mojibakeHits * 3;
}

function decodeUtf8Bytes(bytes: Uint8Array) {
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

function decodeWindows1252Bytes(bytes: Uint8Array) {
  try {
    return new TextDecoder("windows-1252", { fatal: false }).decode(bytes);
  } catch {
    return decodeUtf8Bytes(bytes);
  }
}

function repairCommonPtBrCorruption(value: string) {
  let repaired = value;
  for (const [pattern, replacement] of COMMON_PT_BR_REPAIRS) {
    repaired = repaired.replace(pattern, replacement);
  }
  return repaired;
}

export function decodeTextBytes(data: ArrayBuffer | Uint8Array): string {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  if (bytes.length === 0) return "";

  const utf8 = decodeUtf8Bytes(bytes);
  const win1252 = decodeWindows1252Bytes(bytes);

  return scoreDecodedText(win1252) < scoreDecodedText(utf8) ? win1252 : utf8;
}

export function fixMojibake(value: unknown): string {
  const input = String(value ?? "");
  if (!input) return "";

  let output = input;

  if (looksMojibake(output)) {
    try {
      const bytes = Uint8Array.from([...output].map((char) => char.charCodeAt(0) & 0xff));
      const decoded = decodeUtf8Bytes(bytes);
      if (scoreDecodedText(decoded) <= scoreDecodedText(output)) {
        output = decoded || output;
      }
    } catch {
      // Mantém o texto original se a redecodificação falhar.
    }
  }

  return repairCommonPtBrCorruption(output);
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
