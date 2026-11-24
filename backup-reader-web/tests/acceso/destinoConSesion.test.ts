import { describe, expect, it } from "vitest";
import { destinoConSesion, RUTAS_CON_PLAN } from "../../config/acceso";

describe("destinoConSesion", () => {
  it("sin plan: no se entra al panel llegue como llegue (el atajo por Ayuda)", () => {
    for (const r of RUTAS_CON_PLAN) expect(destinoConSesion(r, false)).toBe("/plans");
  });

  it("sin plan: al crear cuenta o iniciar sesión, a planes", () => {
    expect(destinoConSesion("/auth", false)).toBe("/plans");
    expect(destinoConSesion("/login", false)).toBe("/plans");
  });

  it("sin plan: Ayuda, legales, Mi cuenta y planes se pueden ver", () => {
    for (const r of ["/help", "/privacyPolicy", "/termsConditions", "/account", "/plans", "/payment", "/"]) {
      expect(destinoConSesion(r, false)).toBeNull();
    }
  });

  it("con plan: al entrar o desde la home, al panel; en el resto se queda", () => {
    expect(destinoConSesion("/auth", true)).toBe("/dashboard");
    expect(destinoConSesion("/", true)).toBe("/dashboard");
    expect(destinoConSesion("/dashboard", true)).toBeNull();
    expect(destinoConSesion("/help", true)).toBeNull();
  });
});
