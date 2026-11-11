import { describe, expect, it } from "vitest";

import {
  aFecha,
  claveDeDia,
  etiquetaDeDia,
  idiomaConDiaPrimero,
  partirFechaHora,
} from "../../lib/fechas-de-chat";

describe("partirFechaHora", () => {
  it("separa el formato de Android", () => {
    expect(partirFechaHora("9/8/26 08:10")).toEqual({ fecha: "9/8/26", hora: "08:10" });
  });

  it("separa el formato ISO con segundos", () => {
    expect(partirFechaHora("2026-09-08 08:10:33")).toEqual({
      fecha: "2026-09-08",
      hora: "08:10:33",
    });
  });

  it("conserva AM/PM", () => {
    expect(partirFechaHora("9/8/26 8:10 PM").hora).toBe("8:10 PM");
  });

  it("aguanta que falte una de las dos partes", () => {
    expect(partirFechaHora("08:10")).toEqual({ fecha: "", hora: "08:10" });
    expect(partirFechaHora("9/8/26")).toEqual({ fecha: "9/8/26", hora: "" });
    expect(partirFechaHora("")).toEqual({ fecha: "", hora: "" });
    expect(partirFechaHora(null)).toEqual({ fecha: "", hora: "" });
  });
});

describe("claveDeDia", () => {
  it("agrupa por la fecha en crudo, sin interpretarla", () => {
    /* Esto es lo que impide que un mensaje de las 08:10 y otro de las 23:50
       del mismo día acaben en días distintos por culpa del orden día/mes. */
    expect(claveDeDia("9/8/26 08:10")).toBe(claveDeDia("9/8/26 23:50"));
    expect(claveDeDia("9/8/26 08:10")).not.toBe(claveDeDia("8/9/26 08:10"));
  });
});

describe("aFecha", () => {
  it("lee el formato ISO sin ambigüedad", () => {
    const d = aFecha("2026-09-08", true)!;
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 8, 8]);
  });

  it("si un número pasa de 12, ese es el día pase lo que pase", () => {
    /* 25 no puede ser un mes, así que el idioma del lector no pinta nada. */
    const conDia = aFecha("25/3/26", false)!;
    expect([conDia.getMonth(), conDia.getDate()]).toEqual([2, 25]);
    const alReves = aFecha("3/25/26", true)!;
    expect([alReves.getMonth(), alReves.getDate()]).toEqual([2, 25]);
  });

  it("si ambos caben como mes, decide el idioma", () => {
    expect(aFecha("9/8/26", true)!.getMonth()).toBe(7); // 9 de agosto
    expect(aFecha("9/8/26", false)!.getMonth()).toBe(8); // 8 de septiembre
  });

  it("dos cifras de año son de este siglo", () => {
    expect(aFecha("9/8/26", true)!.getFullYear()).toBe(2026);
  });

  it("devuelve null con lo que no es una fecha", () => {
    expect(aFecha("", true)).toBeNull();
    expect(aFecha("ayer", true)).toBeNull();
    expect(aFecha("45/45/26", true)).toBeNull();
  });
});

describe("idiomaConDiaPrimero", () => {
  it("solo el inglés de EE. UU. pone el mes primero", () => {
    expect(idiomaConDiaPrimero("es")).toBe(true);
    expect(idiomaConDiaPrimero("")).toBe(true);
    expect(idiomaConDiaPrimero("en")).toBe(false);
    expect(idiomaConDiaPrimero("en-US")).toBe(false);
  });
});

describe("etiquetaDeDia", () => {
  const ahora = new Date(2026, 8, 10); // 10 de septiembre de 2026

  it("dice Hoy y Ayer en vez de la fecha", () => {
    expect(etiquetaDeDia("2026-09-10", { hoy: "Hoy", ayer: "Ayer", ahora })).toBe("Hoy");
    expect(etiquetaDeDia("2026-09-09", { hoy: "Hoy", ayer: "Ayer", ahora })).toBe("Ayer");
  });

  it("escribe el día con letras cuando es otro día", () => {
    const texto = etiquetaDeDia("2026-09-01", { idioma: "es", hoy: "Hoy", ayer: "Ayer", ahora });
    expect(texto.toLowerCase()).toContain("septiembre");
    expect(texto).not.toBe("2026-09-01");
  });

  it("añade el año solo si es de otro año", () => {
    const esteAnio = etiquetaDeDia("2026-01-05", { idioma: "es", hoy: "Hoy", ayer: "Ayer", ahora });
    const otroAnio = etiquetaDeDia("2025-01-05", { idioma: "es", hoy: "Hoy", ayer: "Ayer", ahora });
    expect(esteAnio).not.toContain("2026");
    expect(otroAnio).toContain("2025");
  });

  it("si no entiende la fecha, la enseña tal cual en vez de quedarse vacío", () => {
    expect(etiquetaDeDia("no es fecha", { hoy: "Hoy", ayer: "Ayer", ahora })).toBe("no es fecha");
  });
});
