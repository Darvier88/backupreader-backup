import { describe, expect, it } from "vitest";
import { parsearTextoChat } from "../../lib/parsear-chat";
import { partirFechaHora } from "../../lib/fechas-de-chat";

const una = (linea: string) => parsearTextoChat(linea)[0];

describe("parsearTextoChat · Android", () => {
  it("español, 24 h, año corto", () => {
    expect(una("13/11/26 15:27 - Ana: hola")).toEqual(["13/11/26 15:27", "Ana", "hola"]);
  });
  it("español, año largo y «p. m.»", () => {
    expect(una("13/11/2026, 3:27 p. m. - Ana: hola")).toEqual(["13/11/2026 3:27 p. m.", "Ana", "hola"]);
  });
  it("inglés EE. UU. con PM y espacio fino", () => {
    expect(una("11/13/26, 3:27 PM - John: hi")).toEqual(["11/13/26 3:27 PM", "John", "hi"]);
  });
  it("alemán con puntos", () => {
    expect(una("13.11.26, 15:27 - Anna: hallo")).toEqual(["13/11/26 15:27", "Anna", "hallo"]);
  });
  it("francés / portugués / italiano (dd/mm/aaaa)", () => {
    expect(una("13/11/2026 15:27 - Léa: salut")).toEqual(["13/11/2026 15:27", "Léa", "salut"]);
    expect(una("13/11/2026 15:27 - João: olá")).toEqual(["13/11/2026 15:27", "João", "olá"]);
  });
  it("año primero", () => {
    expect(una("2026-11-13 15:27 - Ana: hola")).toEqual(["2026-11-13 15:27", "Ana", "hola"]);
  });
});

describe("parsearTextoChat · iPhone", () => {
  it("español con corchetes y segundos", () => {
    expect(una("[13/11/26, 15:27:05] Ana: hola")).toEqual(["13/11/26 15:27:05", "Ana", "hola"]);
  });
  it("inglés con PM tras espacio fino y marcas invisibles", () => {
    expect(una("‎[11/13/26, 3:27:05 PM] John: ‎hi")).toEqual(["11/13/26 3:27:05 PM", "John", "hi"]);
  });
  it("alemán con puntos", () => {
    expect(una("[13.11.26, 15:27:05] Anna: hallo")).toEqual(["13/11/26 15:27:05", "Anna", "hallo"]);
  });
  it("español con «p. m.»", () => {
    expect(una("[13/11/26, 3:27:05 p. m.] Ana: hola")).toEqual(["13/11/26 3:27:05 p. m.", "Ana", "hola"]);
  });
});

describe("parsearTextoChat · varias líneas y avisos", () => {
  it("un mensaje de varias líneas sigue siendo uno, también con una fecha dentro", () => {
    const filas = parsearTextoChat(
      "13/11/26 15:27 - Ana: primera línea\nsegunda línea\nquedamos el 14/11/26 a las 10:00\n13/11/26 15:28 - Luis: vale"
    );
    expect(filas).toHaveLength(2);
    expect(filas[0][2]).toBe("primera línea\nsegunda línea\nquedamos el 14/11/26 a las 10:00");
    expect(filas[1]).toEqual(["13/11/26 15:28", "Luis", "vale"]);
  });
  it("avisos del sistema sin remitente", () => {
    expect(una("13/11/26 15:27 - Los mensajes y las llamadas están cifrados de extremo a extremo.")).toEqual([
      "13/11/26 15:27",
      "",
      "Los mensajes y las llamadas están cifrados de extremo a extremo.",
    ]);
  });
  it("saltos de línea de Windows (zip rehecho en el ordenador)", () => {
    expect(parsearTextoChat("13/11/26 15:27 - Ana: hola\r\n13/11/26 15:28 - Luis: adiós\r\n")).toEqual([
      ["13/11/26 15:27", "Ana", "hola"],
      ["13/11/26 15:28", "Luis", "adiós"],
    ]);
  });
  it("lo que lee fechas-de-chat sale bien de cada formato", () => {
    for (const linea of [
      "13/11/2026, 3:27 p. m. - Ana: x",
      "[11/13/26, 3:27:05 PM] John: x",
      "13.11.26, 15:27 - Anna: x",
      "2026-11-13 15:27 - Ana: x",
    ]) {
      const { fecha, hora } = partirFechaHora(una(linea)[0]);
      expect(fecha).not.toBe("");
      expect(hora).not.toBe("");
    }
  });
  it("texto vacío o raro", () => {
    expect(parsearTextoChat("")).toEqual([]);
    expect(parsearTextoChat("sin fechas")).toEqual([]);
  });
});
