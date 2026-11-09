import { describe, it, expect } from "vitest";

import {
  empaquetarIndice,
  abrirIndice,
  indexarYSubir,
  rutaDelIndice,
} from "../../lib/busqueda/piezaIndice";
import { buscarEnIndice, construirIndice, ID_PIEZA_INDICE } from "../../lib/busqueda/indice";

/**
 * El índice cifrado, de ida y vuelta, con criptografía de verdad.
 *
 * Los otros tests prueban la lógica del índice con objetos en memoria. Este
 * prueba que sobreviva al viaje: cifrar, "subir", bajar y descifrar. Es donde
 * se vería un fallo de AAD o de empaquetado, que no se nota hasta que alguien
 * intenta leer lo que guardó.
 */

const dekDePrueba = () => new Uint8Array(32).fill(7);

const filas = (pares: Array<[string, string]>): string[][] =>
  pares.map(([quien, que]) => ["2024-01-01 10:00", quien, que]);

describe("la pieza del índice", () => {
  it("va y vuelve: lo que se guarda es lo que se lee", async () => {
    const dek = dekDePrueba();
    const original = construirIndice({
      backupId: "b1",
      nombre: "Chat con Yuli",
      filas: filas([
        ["Yuli", "mañana nos vemos"],
        ["Darwin", "dale"],
      ]),
    });

    const blob = await empaquetarIndice(original, dek);
    const leido = await abrirIndice(blob, dek, "b1");

    expect(leido).not.toBeNull();
    expect(leido!.nombre).toBe("Chat con Yuli");
    expect(leido!.contactos.sort()).toEqual(["Darwin", "Yuli"]);
    /* Y sigue sirviendo para buscar después del viaje, que es el punto. */
    expect(buscarEnIndice(leido!, "mañana")!.mensajes).toEqual([0]);
  });

  it("NO se puede leer con otra clave", async () => {
    const blob = await empaquetarIndice(
      construirIndice({ backupId: "b1", nombre: "n", filas: filas([["A", "hola"]]) }),
      dekDePrueba()
    );

    const otra = new Uint8Array(32).fill(9);
    expect(await abrirIndice(blob, otra, "b1")).toBeNull();
  });

  it("NO se puede colar el índice de un backup en otro", async () => {
    /* El AAD ata la pieza a su backup. Sin esto, el servidor podría
       intercambiar índices entre backups del mismo usuario y la búsqueda
       devolvería resultados del chat equivocado. */
    const dek = dekDePrueba();
    const blob = await empaquetarIndice(
      construirIndice({ backupId: "b1", nombre: "n", filas: filas([["A", "hola"]]) }),
      dek
    );

    expect(await abrirIndice(blob, dek, "OTRO")).toBeNull();
  });

  it("un blob corrupto devuelve null en vez de reventar", async () => {
    const basura = new Blob([new Uint8Array(80).fill(3)]);
    expect(await abrirIndice(basura, dekDePrueba(), "b1")).toBeNull();
  });

  it("indexarYSubir deja la pieza en la ruta esperada", async () => {
    const subidas: Array<{ ruta: string; blob: Blob }> = [];

    const indice = await indexarYSubir({
      uid: "uid123",
      backupId: "b1",
      nombre: "Chat con Yuli",
      filas: filas([["Yuli", "hola"]]),
      dek: dekDePrueba(),
      subir: async (ruta, blob) => {
        subidas.push({ ruta, blob });
      },
    });

    expect(subidas).toHaveLength(1);
    expect(subidas[0].ruta).toBe(`backups/uid123/b1/p/${ID_PIEZA_INDICE}`);
    expect(subidas[0].ruta).toBe(rutaDelIndice("uid123", "b1"));
    expect(indice.contactos).toEqual(["Yuli"]);
  });

  it("el índice pesa mucho menos que el chat", async () => {
    /* Si no, no sería un atajo. Un chat de mil mensajes repetitivos debe dar
       un índice de una fracción del texto. */
    const muchos: Array<[string, string]> = Array.from({ length: 1000 }, (_, i) => [
      i % 2 ? "Yuli" : "Darwin",
      `mensaje numero ${i} sobre el cumpleaños y la playa`,
    ]);
    const texto = muchos.map((m) => m.join(" ")).join("\n");

    const indice = construirIndice({ backupId: "b", nombre: "n", filas: filas(muchos) });
    const blob = await empaquetarIndice(indice, dekDePrueba());

    expect(blob.size).toBeLessThan(texto.length);
  });
});
