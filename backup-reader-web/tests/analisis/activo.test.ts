import { describe, it, expect } from "vitest";

import { ANALISIS_ACTIVO } from "../../lib/analisis/activo";

/* El interruptor del análisis. Lo que importa aquí es que, sin variable, la
   función esté apagada: es lo que pasa en las pruebas, en un clon recién
   hecho y en cualquier despliegue anterior a esta rama. */
describe("ANALISIS_ACTIVO", () => {
  it("está apagado cuando no hay variable de entorno", () => {
    expect(process.env.NEXT_PUBLIC_ANALISIS_ENABLED).toBeUndefined();
    expect(ANALISIS_ACTIVO).toBe(false);
  });

  it("es un booleano, no una cadena", () => {
    expect(typeof ANALISIS_ACTIVO).toBe("boolean");
  });
});
