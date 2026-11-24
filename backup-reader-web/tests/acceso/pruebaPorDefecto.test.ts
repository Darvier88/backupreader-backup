import { describe, expect, it, vi } from "vitest";

/* Sin la variable, NO hay prueba gratuita: una cuenta nueva sin plan no entra.
   Antes era al revés y un despliegue sin la variable regalaba 15 días. */
describe("prueba gratuita por defecto", () => {
  it("apagada si NEXT_PUBLIC_FREE_TRIAL_ENABLED no está definida", async () => {
    delete process.env.NEXT_PUBLIC_FREE_TRIAL_ENABLED;
    vi.resetModules();
    const { tieneAcceso } = await import("../../config/acceso");
    expect(tieneAcceso({ plan: null }, 0)).toBe(false);
    expect(tieneAcceso({ plan: "NrcM81oeU0KMb6RYduBw" }, 0)).toBe(true);
  });

  it("solo se enciende con «true»", async () => {
    process.env.NEXT_PUBLIC_FREE_TRIAL_ENABLED = "true";
    vi.resetModules();
    const { tieneAcceso } = await import("../../config/acceso");
    expect(tieneAcceso({ plan: null }, 0)).toBe(true);
    delete process.env.NEXT_PUBLIC_FREE_TRIAL_ENABLED;
  });
});
