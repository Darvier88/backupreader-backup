import { describe, it, expect } from "vitest";
import { runSelfTest } from "../../lib/backupreader-crypto/selftest";

describe("núcleo criptográfico", async () => {
  const resultados = await runSelfTest();
  for (const r of resultados) {
    it(r.name, () => expect(r.ok, r.detail).toBe(true));
  }
});