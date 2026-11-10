import { describe, it, expect } from "vitest";

import {
  partirTitulo,
  nombreDelContacto,
  iniciales,
} from "../../lib/nombres-de-chat";

/**
 * Cómo se nombra un chat en la interfaz.
 *
 * Importa que sea una sola función y no una por pantalla: si el inicio, el
 * panel y los resultados de búsqueda recortan el título cada uno a su manera,
 * el mismo chat sale con tres nombres y parecen tres chats distintos.
 */

describe("partirTitulo", () => {
  it("separa el nombre de la fecha de la exportación", () => {
    const r = partirTitulo("Chat de WhatsApp con Mamá Tue, Sep 15, 2026, 07 PM");
    expect(r.nombre).toBe("Chat de WhatsApp con Mamá");
    expect(r.fecha).toContain("Sep 15");
  });

  it("sin fecha devuelve el título entero como nombre", () => {
    expect(partirTitulo("WhatsApp Chat - TG.zip").nombre).toBe("WhatsApp Chat - TG.zip");
  });

  it("aguanta vacío", () => {
    expect(partirTitulo("")).toEqual({ nombre: "", fecha: "" });
  });
});

describe("nombreDelContacto", () => {
  it("quita el envoltorio de la exportación", () => {
    /* El usuario ya sabe que es un chat de WhatsApp; lo que quiere ver es con
       quién. */
    expect(nombreDelContacto("Chat de WhatsApp con Mamá Tue, Sep 15, 2026, 07 PM")).toBe("Mamá");
    expect(nombreDelContacto("WhatsApp Chat - Yuli Yepes.zip")).toBe("Yuli Yepes");
    expect(nombreDelContacto("Chat con TG")).toBe("TG");
  });

  it("deja en paz un nombre que ya está limpio", () => {
    expect(nombreDelContacto("Pelasalén")).toBe("Pelasalén");
  });

  it("quita el .zip del final", () => {
    expect(nombreDelContacto("TG.zip")).toBe("TG");
  });
});

describe("iniciales", () => {
  it("dos palabras dan una letra de cada una", () => {
    expect(iniciales("Yuli Yepes")).toBe("YY");
    expect(iniciales("WhatsApp Chat - Yuli Yepes.zip")).toBe("YY");
  });

  it("una palabra da sus dos primeras letras", () => {
    /* Con una sola letra, todos los nombres que empiezan igual se verían
       idénticos en la lista, que es justo lo que el avatar viene a evitar. */
    expect(iniciales("TG")).toBe("TG");
    expect(iniciales("Mamá")).toBe("MA");
  });

  it("respeta los acentos en mayúscula", () => {
    expect(iniciales("Ángela")).toBe("ÁN");
  });

  it("ignora la puntuación en vez de meterla en el avatar", () => {
    expect(iniciales("¡Hola! Mundo")).toBe("HM");
  });

  it("sin nombre devuelve algo que se pueda pintar, no vacío", () => {
    /* Un avatar en blanco se lee como un fallo de carga. */
    expect(iniciales("")).toBe("?");
    expect(iniciales("   ")).toBe("?");
    expect(iniciales("!!!")).toBe("?");
  });
});
