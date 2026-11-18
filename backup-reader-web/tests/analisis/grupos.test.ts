import { describe, expect, it } from "vitest";
import { contables, normalizar } from "../../lib/analisis/normalizar";
import { grupos } from "../../lib/analisis/grupos";
import { GRUPO, ANDROID_DIA_PRIMERO, filasDe } from "./ejemplos";

const analizar = (filas: string[][], umbral = 4) => {
  const chat = normalizar(filas);
  return grupos(chat, contables(chat), umbral);
};

describe("grupos", () => {
  it("reconoce un grupo de tres", () => {
    const g = analizar(filasDe(GRUPO));
    expect(g.esGrupo).toBe(true);
    expect(g.personas).toBe(3);
    expect(g.filas.map((f) => f.autor).sort()).toEqual(["Ana", "Beto", "Carla"]);
  });

  it("un chat de dos no es grupo", () => {
    expect(analizar(filasDe(ANDROID_DIA_PRIMERO)).esGrupo).toBe(false);
  });

  it("ordena de más a menos mensajes y reparte el porcentaje", () => {
    const g = analizar(filasDe(GRUPO));
    expect(g.filas[0].mensajes).toBeGreaterThanOrEqual(g.filas[1].mensajes);
    const suma = g.filas.reduce((n, f) => n + f.porcentajeMensajes, 0);
    expect(Math.round(suma)).toBe(100);
  });

  it("separa media, notas de voz y emojis", () => {
    const g = analizar([
      ["13/01/26 9:00", "Ana", "IMG-1.jpg (archivo adjunto)"],
      ["13/01/26 9:01", "Ana", "PTT-1.opus (archivo adjunto)"],
      ["13/01/26 9:02", "Beto", "vale 😂😂"],
      ["13/01/26 9:03", "Carla", "ok"],
    ]);
    const ana = g.filas.find((f) => f.autor === "Ana")!;
    expect(ana.media).toBe(2);
    expect(ana.notasDeVoz).toBe(1);
    expect(g.filas.find((f) => f.autor === "Beto")!.emojis).toBe(2);
  });

  it("da las palabras por mensaje, que es lo que distingue el estilo", () => {
    const g = analizar([
      ["13/01/26 9:00", "Ana", "una dos tres cuatro"],
      ["13/01/26 9:01", "Beto", "sip"],
      ["13/01/26 9:02", "Carla", "ok"],
    ]);
    expect(g.filas.find((f) => f.autor === "Ana")!.palabrasPorMensaje).toBe(4);
    expect(g.filas.find((f) => f.autor === "Beto")!.palabrasPorMensaje).toBe(1);
  });

  it("cuenta quién empieza cada conversación", () => {
    const g = analizar([
      ["13/01/26 9:00", "Ana", "hola"],
      ["13/01/26 9:05", "Beto", "hola"],
      ["14/01/26 9:00", "Carla", "buenas"],
      ["14/01/26 9:05", "Ana", "hey"],
    ]);
    expect(g.filas.find((f) => f.autor === "Ana")!.inicios).toBe(1);
    expect(g.filas.find((f) => f.autor === "Carla")!.inicios).toBe(1);
    expect(g.filas.find((f) => f.autor === "Beto")!.inicios).toBe(0);
    expect(g.conversaciones).toBe(2);
  });

  it("guarda el primero y el último mensaje de cada uno", () => {
    const g = analizar(filasDe(GRUPO));
    const ana = g.filas.find((f) => f.autor === "Ana")!;
    expect(ana.primero!.getDate()).toBe(13);
    expect(ana.ultimo!.getDate()).toBe(13);
  });

  it("señala a quien lleva meses sin escribir", () => {
    const g = analizar([
      ["05/01/26 9:00", "Ana", "hola"],
      ["05/01/26 9:01", "Carla", "hola, me voy un tiempo"],
      ["20/05/26 9:00", "Ana", "cuánto tiempo"],
      ["20/05/26 9:02", "Beto", "pues sí"],
    ]);
    expect(g.masCallado!.autor).toBe("Carla");
  });

  it("no señala a nadie si todos han escrito hace poco", () => {
    expect(analizar(filasDe(GRUPO)).masCallado).toBeNull();
  });

  it("se mide contra el final del chat, no contra hoy", () => {
    /* Un export viejo dejaría a todo el mundo callado si se comparase con la
       fecha de hoy. */
    const g = analizar([
      ["05/01/20 9:00", "Ana", "hola"],
      ["05/01/20 9:01", "Beto", "hola"],
      ["06/01/20 9:00", "Carla", "buenas"],
    ]);
    expect(g.masCallado).toBeNull();
  });

  it("un chat vacío no se rompe", () => {
    const g = analizar([]);
    expect(g.filas).toEqual([]);
    expect(g.esGrupo).toBe(false);
    expect(g.masCallado).toBeNull();
  });
});
