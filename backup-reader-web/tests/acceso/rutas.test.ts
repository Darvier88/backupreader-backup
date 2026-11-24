import { describe, expect, it } from "vitest";

import { esRutaPrivada, exigePlan } from "../../config/rutas";

/**
 * Qué páginas quedan detrás del paso de pago.
 *
 * El fallo que esto evita no se veía: la comprobación era una lista de tres
 * rutas escrita dentro del componente que redirige, y `/initialDashboard`
 * —que pinta la tarjeta de subir chats— no estaba en ella. Desde `/plans` se
 * llegaba por Ayuda y se podía usar la aplicación entera sin pagar. No fallaba
 * nada: la página funcionaba, que es lo que lo hacía difícil de ver.
 */

describe("páginas que exigen plan", () => {
  it("incluyen todas las que dejan usar la aplicación", () => {
    for (const ruta of ["/dashboard", "/initialDashboard", "/backups/abc123"]) {
      expect(exigePlan(ruta), ruta).toBe(true);
    }
  });

  it("cubren cualquier backup sin enumerarlos", () => {
    expect(exigePlan("/backups/loquesea")).toBe(true);
    expect(exigePlan("/backups")).toBe(true);
  });

  it("NO incluyen la cuenta: ahí se contrata", () => {
    /* Encerrar fuera de la cuenta a quien no tiene plan le impediría pagar,
       que es justo lo contrario de lo que se busca. */
    expect(exigePlan("/account")).toBe(false);
    expect(esRutaPrivada("/account")).toBe(true);
  });

  it("NO incluyen las páginas abiertas", () => {
    for (const ruta of ["/", "/help", "/plans", "/payment", "/login", "/auth", "/privacyPolicy"]) {
      expect(exigePlan(ruta), ruta).toBe(false);
      expect(esRutaPrivada(ruta), ruta).toBe(false);
    }
  });

  it("no se dejan engañar por un nombre que empiece igual", () => {
    /* `/dashboards-publicos` no es `/dashboard`. */
    expect(exigePlan("/dashboardcualquiera")).toBe(false);
    expect(esRutaPrivada("/accountancy")).toBe(false);
  });
});

describe("páginas privadas", () => {
  it("son las que exigen plan más la cuenta", () => {
    for (const ruta of ["/dashboard", "/initialDashboard", "/backups/abc", "/account"]) {
      expect(esRutaPrivada(ruta), ruta).toBe(true);
    }
  });
});
