import { describe, expect, it } from "vitest";
import { contables, contarPalabras, normalizar } from "../../lib/analisis/normalizar";
import {
  ANDROID_DIA_PRIMERO,
  ANDROID_MES_PRIMERO,
  CON_TODO,
  CORTO,
  GRUPO,
  IOS,
  filasDe,
} from "./ejemplos";

describe("contarPalabras", () => {
  it("cuenta palabras, no trozos separados por espacios", () => {
    expect(contarPalabras("hola qué tal")).toBe(3);
    expect(contarPalabras("hola... ¿qué tal?")).toBe(3);
    expect(contarPalabras("  ")).toBe(0);
    expect(contarPalabras("")).toBe(0);
  });

  it("no cuenta los emojis como palabras", () => {
    expect(contarPalabras("vale 😂😂")).toBe(1);
  });
});

describe("normalizar", () => {
  it("separa autores y guarda el índice de cada fila", () => {
    const chat = normalizar(filasDe(ANDROID_DIA_PRIMERO));
    expect(chat.autores).toEqual(["Ana", "Beto"]);
    expect(chat.mensajes).toHaveLength(7);
    expect(chat.mensajes.map((m) => m.indice)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(chat.sinFecha).toBe(0);
  });

  it("coloca el rango de fechas de verdad, con hora", () => {
    const chat = normalizar(filasDe(ANDROID_DIA_PRIMERO));
    expect(chat.desde!.getDate()).toBe(13);
    expect(chat.desde!.getHours()).toBe(9);
    expect(chat.hasta!.getDate()).toBe(14);
    expect(chat.hasta!.getHours()).toBe(10);
    expect(chat.hasta!.getMinutes()).toBe(5);
  });

  it("deduce el formato de cada chat por su cuenta", () => {
    const es = normalizar(filasDe(ANDROID_DIA_PRIMERO));
    const en = normalizar(filasDe(ANDROID_MES_PRIMERO));
    /* En los dos, el 13 de enero es el 13 de enero. */
    expect(es.desde!.getMonth()).toBe(0);
    expect(es.desde!.getDate()).toBe(13);
    expect(en.desde!.getMonth()).toBe(0);
    expect(en.desde!.getDate()).toBe(13);
  });

  it("entiende el export de iPhone", () => {
    const chat = normalizar(filasDe(IOS));
    expect(chat.autores).toEqual(["Ana", "Beto"]);
    expect(chat.mensajes.every((m) => m.fecha !== null)).toBe(true);
    expect(chat.desde!.getSeconds()).toBe(12);
  });

  describe("un chat con de todo", () => {
    const chat = normalizar(filasDe(CON_TODO));
    const porTipo = (t: string) => chat.mensajes.filter((m) => m.tipo === t);

    it("deja fuera de los autores los avisos del sistema", () => {
      expect(chat.autores).toEqual(["Ana", "Beto"]);
      expect(chat.sistema).toBe(2);
      expect(porTipo("sistema").every((m) => m.autor === "")).toBe(true);
    });

    it("cuenta los eliminados aparte y sin palabras", () => {
      expect(chat.eliminados).toBe(1);
      const borrado = porTipo("eliminado");
      expect(borrado).toHaveLength(1);
      expect(borrado[0].autor).toBe("Beto");
      expect(borrado[0].palabras).toBe(0);
    });

    it("reconoce la clase de cada adjunto", () => {
      expect(porTipo("imagen")).toHaveLength(1);
      expect(porTipo("audio")).toHaveLength(1);
      expect(porTipo("documento")).toHaveLength(1);
      expect(porTipo("multimedia")).toHaveLength(1);
    });

    it("el nombre del archivo no suma palabras", () => {
      expect(porTipo("imagen")[0].palabras).toBe(0);
      expect(porTipo("audio")[0].palabras).toBe(0);
      expect(porTipo("documento")[0].palabras).toBe(0);
      expect(porTipo("multimedia")[0].palabras).toBe(0);
    });

    it("marca el editado y le quita la marca al texto", () => {
      const editado = chat.mensajes.filter((m) => m.editado);
      expect(editado).toHaveLength(1);
      expect(editado[0].texto).toBe("Gracias crack");
      expect(editado[0].palabras).toBe(2);
    });

    it("contables deja solo lo que escribió alguien y tiene fecha", () => {
      const lista = contables(chat);
      expect(lista).toHaveLength(chat.mensajes.length - chat.sistema - chat.eliminados);
      expect(lista.every((m) => m.autor !== "")).toBe(true);
      expect(lista.every((m) => m.fecha !== null)).toBe(true);
    });
  });

  it("el pie de una foto sí cuenta como palabras", () => {
    const chat = normalizar([
      ["13/01/26 9:00", "Ana", "IMG-20260113-WA0001.jpg (archivo adjunto)"],
      ["13/01/26 9:01", "Ana", "IMG-20260113-WA0002.jpg (archivo adjunto)\nmira qué vistas"],
    ]);
    expect(chat.mensajes[0].palabras).toBe(0);
    expect(chat.mensajes[1].tipo).toBe("imagen");
    expect(chat.mensajes[1].palabras).toBe(3);
  });

  it("aguanta un grupo de tres", () => {
    const chat = normalizar(filasDe(GRUPO));
    expect(chat.autores).toEqual(["Ana", "Beto", "Carla"]);
  });

  it("aguanta un chat diminuto sin romperse", () => {
    const chat = normalizar(filasDe(CORTO));
    expect(chat.mensajes).toHaveLength(2);
    expect(chat.autores).toEqual(["Ana", "Beto"]);
  });

  it("cuenta las filas con fecha ilegible en vez de inventarlas", () => {
    const chat = normalizar([
      ["13/01/26 9:00", "Ana", "hola"],
      ["", "Beto", "sin fecha"],
      ["31/02/26 9:00", "Ana", "fecha imposible"],
    ]);
    expect(chat.sinFecha).toBe(2);
    expect(contables(chat)).toHaveLength(1);
  });

  it("no se rompe con una lista vacía", () => {
    const chat = normalizar([]);
    expect(chat.mensajes).toEqual([]);
    expect(chat.autores).toEqual([]);
    expect(chat.desde).toBeNull();
    expect(chat.hasta).toBeNull();
  });
});
