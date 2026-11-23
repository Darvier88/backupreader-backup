import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { filasDelChat } from "../../lib/filas-del-chat";

/**
 * Que el chat se parsee en UN solo sitio.
 *
 * El índice de búsqueda guarda NÚMEROS de mensaje, no texto. Eso significa
 * que la pantalla, el indexador y los fragmentos de resultados tienen que
 * partir el chat exactamente igual: si uno cambia y los otros no, buscas una
 * palabra y saltas a otro mensaje, o lees un fragmento que no es el que
 * coincidió. Y no falla ruidosamente, solo enseña lo que no es.
 *
 * La decisión estaba copiada en los tres, que es justo como empiezan a
 * separarse. Esta prueba vigila el código fuente a propósito: no hay forma de
 * provocar el fallo desde fuera sin montar los tres caminos enteros, y para
 * cuando se notara ya estaría en producción.
 */

const FUENTE = resolve(__dirname, "../../context/StorageContext.tsx");

describe("el chat se parsea en un solo sitio", () => {
  it("StorageContext no llama a ningún parser por su cuenta", () => {
    const codigo = readFileSync(FUENTE, "utf8");

    /* Lo que no puede aparecer: una llamada directa a cualquiera de los dos
       parsers. Todas tienen que ir por `filasDelChat`. */
    expect(codigo).not.toMatch(/\bparsearTextoChat\s*\(/);
    expect(codigo).not.toMatch(/\bparsearTextoInstagram\s*\(/);
    expect(codigo).not.toMatch(/\bparsearJsonInstagram\b/);
  });

  it("y sí llama al ayudante, en los tres sitios", () => {
    const codigo = readFileSync(FUENTE, "utf8");
    const usos = codigo.match(/\bfilasDelChat\s*\(/g) || [];
    /* La pantalla, el indexador y los fragmentos de búsqueda. */
    expect(usos.length).toBeGreaterThanOrEqual(3);
  });
});

describe("el ayudante decide igual para todos", () => {
  const filas = [
    ["2026-01-01 10:00", "Ana", "hola"],
    ["2026-01-01 10:01", "Beto", "adiós"],
  ];

  const comoInstagram = JSON.stringify({
    messages: [
      { sender_name: "Beto", timestamp_ms: 1767265260000, content: "adiós" },
      { sender_name: "Ana", timestamp_ms: 1767265200000, content: "hola" },
    ],
  });

  it("un chat de Instagram se parsea como Instagram aunque la pieza no se llame .json", () => {
    const salida = filasDelChat(
      { texto: comoInstagram, nombre: "pieza-sin-extension", textos: [comoInstagram] },
      "instagram"
    );
    expect(salida.map((f) => f[2])).toEqual(["hola", "adiós"]);
  });

  it("y uno de WhatsApp se parsea como WhatsApp", () => {
    const texto = `[1/1/26, 10:00:00] Ana: hola\n[1/1/26, 10:01:00] Beto: adiós\n`;
    const salida = filasDelChat({ texto, nombre: "_chat.txt" }, "whatsapp");
    expect(salida.map((f) => f[2])).toEqual(["hola", "adiós"]);
    expect(salida.map((f) => f[1])).toEqual(["Ana", "Beto"]);
  });

  it("el mismo chat da las MISMAS filas se pida desde donde se pida", () => {
    /* Es lo único que de verdad importa: tres llamadas, tres resultados
       idénticos, porque el índice guarda posiciones de esta lista. */
    const pantalla = filasDelChat({ texto: comoInstagram, nombre: "message_1.json" }, "instagram");
    const indexador = filasDelChat({ texto: comoInstagram, nombre: "message_1.json" }, "instagram");
    const fragmentos = filasDelChat({ texto: comoInstagram, nombre: "message_1.json" }, "instagram");

    expect(indexador).toEqual(pantalla);
    expect(fragmentos).toEqual(pantalla);
    expect(pantalla).toHaveLength(filas.length);
  });
});
