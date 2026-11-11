import { describe, expect, it } from "vitest";
import { etiquetaApertura } from "../../lib/aperturas";

/* «Abierto hoy» / «Abierto ayer» / «Abierto 2 sep» en Recientes (8b). */
describe("etiquetaApertura", () => {
  const hoy = new Date(2026, 10, 11, 10, 0); // 11 nov 2026, 10:00

  it("hoy, aunque haya sido a primera hora", () => {
    expect(etiquetaApertura(new Date(2026, 10, 11, 0, 5).getTime(), "es", hoy)).toBe("hoy");
  });

  it("ayer, aunque hayan pasado menos de 24 horas", () => {
    expect(etiquetaApertura(new Date(2026, 10, 10, 23, 50).getTime(), "es", hoy)).toBe("ayer");
  });

  it("fecha corta sin punto en español", () => {
    const r = etiquetaApertura(new Date(2026, 8, 2).getTime(), "es", hoy);
    expect(r).toMatch(/^2 sept?$/);
  });

  it("añade el año si no es el actual", () => {
    expect(etiquetaApertura(new Date(2025, 8, 2).getTime(), "en", hoy)).toMatch(/2025/);
  });
});
