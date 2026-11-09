import { describe, it, expect } from "vitest";

import {
  construirIndice,
  buscarEnIndice,
  tokenizar,
  normalizar,
  indiceVigente,
  TOPE_APARICIONES,
  VERSION_INDICE,
} from "../../lib/busqueda/indice";

/**
 * El índice de búsqueda.
 *
 * Lo que se comprueba es que encuentre lo que hay y que NO invente lo que no:
 * un buscador que devuelve de menos hace creer que el mensaje no existe, que
 * es peor que tardar.
 */

const filas = (pares: Array<[string, string]>): string[][] =>
  pares.map(([quien, que], i) => [`2024-01-0${(i % 9) + 1} 10:00`, quien, que]);

const chatDeEjemplo = () =>
  construirIndice({
    backupId: "b1",
    nombre: "Chat con Yuli",
    filas: filas([
      ["Yuli", "Hola, ¿cómo estás?"],
      ["Darwin", "Bien, ¿y tú?"],
      ["Yuli", "Mañana es el cumpleaños de mi mamá"],
      ["Darwin", "Qué bueno, felicítala de mi parte"],
      ["Yuli", "IMG-20240103-WA0001.jpg"],
    ]),
  });

describe("normalizar y tokenizar", () => {
  it("quita tildes, porque nadie las escribe en un buscador", () => {
    expect(normalizar("Acción")).toBe("accion");
    expect(normalizar("YULÍ")).toBe("yuli");
  });

  it("conserva la ñ: 'año' y 'ano' no son la misma palabra", () => {
    /* Si la ñ se tratara como una n con tilde, buscar "ano" encontraría
       "año" y al revés. En español eso no es un acento, es otra letra. */
    expect(normalizar("año")).toBe("año");
    expect(normalizar("año")).not.toBe("ano");
  });

  it("separa por puntuación y emojis, que no son parte de la palabra", () => {
    expect(tokenizar("hola,mundo!🎉fin")).toEqual(["hola", "mundo", "fin"]);
  });

  it("descarta palabras de una letra", () => {
    expect(tokenizar("a mi y tu")).toEqual(["mi", "tu"]);
  });
});

describe("construirIndice", () => {
  it("recoge los contactos que hablan", () => {
    const i = chatDeEjemplo();
    expect(i.contactos.sort()).toEqual(["Darwin", "Yuli"]);
  });

  it("cuenta los mensajes y marca la versión", () => {
    const i = chatDeEjemplo();
    expect(i.mensajes).toBe(5);
    expect(i.v).toBe(VERSION_INDICE);
  });

  it("un mensaje con la palabra repetida cuenta una vez", () => {
    /* Sin esto, el recuento de resultados contaría repeticiones dentro de un
       mismo mensaje como si fueran mensajes distintos. */
    const i = construirIndice({
      backupId: "b",
      nombre: "n",
      filas: filas([["A", "casa casa casa"]]),
    });
    expect(i.palabras["casa"]).toEqual([0]);
  });

  it("RECORTA las palabras muy repetidas en vez de engordar sin límite", () => {
    const muchas: Array<[string, string]> = Array.from(
      { length: TOPE_APARICIONES + 25 },
      () => ["A", "que tal"]
    );
    const i = construirIndice({ backupId: "b", nombre: "n", filas: filas(muchas) });

    expect(i.palabras["que"].length).toBe(TOPE_APARICIONES);
    expect(i.recortadas["que"]).toBe(TOPE_APARICIONES + 25);
  });

  it("no indexa la fecha", () => {
    /* Buscar "2024" y que salgan los nueve mil mensajes del año no le sirve a
       nadie, y engorda el índice. */
    const i = chatDeEjemplo();
    expect(i.palabras["2024"]).toBeUndefined();
  });
});

describe("buscarEnIndice", () => {
  it("encuentra el contacto Y los mensajes, que es lo que se pidió", () => {
    const r = buscarEnIndice(chatDeEjemplo(), "Yuli");
    expect(r).not.toBeNull();
    expect(r!.contactos).toEqual(["Yuli"]);
    /* Los tres que escribió ella: el remitente también se indexa. */
    expect(r!.mensajes).toEqual([0, 2, 4]);
  });

  it("COINCIDE POR PREFIJO: 'cumple' encuentra 'cumpleaños'", () => {
    /* Exigir la palabra completa haría que el buscador pareciera roto justo
       en el caso más común, que es escribir a medias. */
    const r = buscarEnIndice(chatDeEjemplo(), "cumple");
    expect(r!.mensajes).toEqual([2]);
  });

  it("encuentra un contacto escrito a medias", () => {
    const i = construirIndice({
      backupId: "b",
      nombre: "n",
      filas: filas([["Yulisa Pacheco", "hola"]]),
    });
    const r = buscarEnIndice(i, "Yuli");
    expect(r!.contactos).toEqual(["Yulisa Pacheco"]);
  });

  it("con varias palabras exige TODAS, no cualquiera", () => {
    /* Si fuera "cualquiera", añadir una palabra para afinar daría MÁS
       resultados en vez de menos, que es lo contrario de lo que se espera. */
    const i = construirIndice({
      backupId: "b",
      nombre: "n",
      filas: filas([
        ["A", "vamos a la playa"],
        ["A", "vamos al cine"],
        ["A", "la playa estaba llena"],
      ]),
    });

    expect(buscarEnIndice(i, "vamos")!.mensajes).toEqual([0, 1]);
    expect(buscarEnIndice(i, "vamos playa")!.mensajes).toEqual([0]);
  });

  it("devuelve null cuando no hay nada, no un resultado vacío", () => {
    expect(buscarEnIndice(chatDeEjemplo(), "bicicleta")).toBeNull();
  });

  it("devuelve null con una consulta de una sola letra", () => {
    /* Coincidiría con casi todo y la respuesta no diría nada. Null distingue
       "no busqué" de "busqué y no hay". */
    expect(buscarEnIndice(chatDeEjemplo(), "a")).toBeNull();
  });

  it("encuentra sin tilde lo que se escribió con tilde", () => {
    const r = buscarEnIndice(chatDeEjemplo(), "mama");
    expect(r!.mensajes).toEqual([2]);
  });

  it("marca el resultado como aproximado si el índice venía recortado", () => {
    const muchas: Array<[string, string]> = Array.from(
      { length: TOPE_APARICIONES + 10 },
      () => ["A", "hola"]
    );
    const i = construirIndice({ backupId: "b", nombre: "n", filas: filas(muchas) });

    const r = buscarEnIndice(i, "hola");
    expect(r!.aproximado).toBe(true);
    /* No se finge un número exacto que no se tiene. */
    expect(r!.total).toBe(TOPE_APARICIONES);
  });

  it("encuentra los archivos por su nombre", () => {
    const r = buscarEnIndice(chatDeEjemplo(), "jpg");
    expect(r!.mensajes).toEqual([4]);
  });
});

describe("indiceVigente", () => {
  it("acepta un índice de la versión actual", () => {
    expect(indiceVigente(chatDeEjemplo())).toBe(true);
  });

  it("rechaza uno de otra versión, para que se reconstruya", () => {
    expect(indiceVigente({ ...chatDeEjemplo(), v: 0 })).toBe(false);
  });

  it("rechaza basura sin reventar", () => {
    expect(indiceVigente(null)).toBe(false);
    expect(indiceVigente("{}")).toBe(false);
    expect(indiceVigente({ v: VERSION_INDICE })).toBe(false);
  });
});
