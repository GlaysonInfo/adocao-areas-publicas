import { describe, expect, it } from "vitest";
import { decodeTextBytes, fixMojibake, sanitizeText } from "../lib/text-normalize";

describe("text-normalize", () => {
  it("corrige mojibake UTF-8 lido como latin1", () => {
    expect(fixMojibake("PraÃ§a da Matriz")).toBe("Praça da Matriz");
    expect(sanitizeText("NÃ£o permite estruturas permanentes")).toBe("Não permite estruturas permanentes");
  });

  it("faz fallback para windows-1252 ao decodificar upload", () => {
    const bytes = Uint8Array.from([0x50, 0x72, 0x61, 0xe7, 0x61]);
    expect(decodeTextBytes(bytes)).toBe("Praça");
  });

  it("repara os casos mais comuns com caractere de substituição", () => {
    expect(fixMojibake("Pra�a da Matriz")).toBe("Praça da Matriz");
    expect(fixMojibake("N�o permite estruturas permanentes")).toBe("Não permite estruturas permanentes");
  });
});
