import { describe, expect, it } from "vitest";
import { copyPixCode } from "./pixUi";

describe("copyPixCode", () => {
  it("copia o código Pix completo", async () => {
    let copied = "";
    const clipboard = { writeText: async (value: string) => { copied = value; } };
    const code = "00020101021226850014br.gov.bcb.pix";

    await expect(copyPixCode(code, clipboard)).resolves.toBe(true);
    expect(copied).toBe(code);
  });

  it("retorna false quando a área de transferência não existe", async () => {
    await expect(copyPixCode("pix-code", undefined)).resolves.toBe(false);
  });
});
