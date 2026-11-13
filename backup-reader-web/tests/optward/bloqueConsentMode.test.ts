import { describe, expect, it } from "vitest";
import { bloqueConsentMode, bloqueConfig } from "../../lib/optward";

/** Ejecuta un bloque inline con un window/document de mentira. */
function ejecutar(codigo: string, cookie = "") {
  const window: any = {};
  const document = { cookie };
  const localStorage = { getItem: () => null };
  new Function("window", "document", "localStorage", codigo)(window, document, localStorage);
  return window;
}

const consentDefault = (w: any) =>
  Array.from(w.dataLayer as any[]).find((x: any) => x[0] === "consent" && x[1] === "default")[2];

describe("bloque de Consent Mode de Optward", () => {
  it("deniega todo salvo lo esencial si no hay decisión previa", () => {
    const w = ejecutar(bloqueConsentMode());
    const d = consentDefault(w);
    expect(d.analytics_storage).toBe("denied");
    expect(d.ad_storage).toBe("denied");
    expect(d.functionality_storage).toBe("granted");
    expect(d.security_storage).toBe("granted");
    expect(w.__consentDefaultSet).toBe(true);
  });

  it("reaplica la decisión guardada en la cookie del banner", () => {
    const valor = encodeURIComponent(
      JSON.stringify({ version: "2025-01", categories: { esenciales: true, analitica: true } })
    );
    const w = ejecutar(bloqueConsentMode(), `fwc_consent_cookie_consent=${valor}`);
    expect(consentDefault(w).analytics_storage).toBe("granted");
    expect(consentDefault(w).personalization_storage).toBe("denied");
  });

  it("ignora una decisión de otra versión del texto", () => {
    const valor = encodeURIComponent(
      JSON.stringify({ version: "2024-01", categories: { analitica: true } })
    );
    const w = ejecutar(bloqueConsentMode(), `fwc_consent_cookie_consent=${valor}`);
    expect(consentDefault(w).analytics_storage).toBe("denied");
  });

  it("pasa al banner el idioma que eligió el visitante en la app", () => {
    const w = ejecutar(bloqueConfig(), "br_lang=en");
    expect(w.__consentLang).toBe("en");
    expect(w.__consentConfig.apiBase).toBe("https://optward.com");
  });
});
