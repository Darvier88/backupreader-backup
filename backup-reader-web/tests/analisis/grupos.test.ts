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
    expect(new Date(ana.primero!).getDate()).toBe(13);
    expect(new Date(ana.ultimo!).getDate()).toBe(13);
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

describe("quién escribe detrás de ti", () => {
  /* Un grupo donde Marcela manda muchísimo: tiene que salir la primera
     detrás de Ana por pura aritmética, y la cifra sola engañaría. */
  const filas: string[][] = [];
  const base = new Date(2026, 0, 5, 9, 0);
  for (let i = 0; i < 40; i++) {
    const t = new Date(base.getTime() + i * 60 * 60 * 1000);
    const sello = `${String(t.getDate()).padStart(2, "0")}/01/26 ${String(t.getHours()).padStart(2, "0")}:00`;
    const siguiente = `${String(t.getDate()).padStart(2, "0")}/01/26 ${String(t.getHours()).padStart(2, "0")}:05`;
    filas.push([sello, "Ana", "algo"]);
    /* Dos de cada tres veces contesta Marcela, una Diego. */
    filas.push([siguiente, i % 3 === 2 ? "Diego" : "Marcela", "vale"]);
  }
  /* Y Marcela además escribe mucho por su cuenta. */
  for (let i = 0; i < 60; i++) {
    filas.push([`20/02/26 ${String(8 + (i % 12)).padStart(2, "0")}:${String(i % 60).padStart(2, "0")}`, "Marcela", "hablo yo"]);
  }

  const chat = normalizar(filas);
  const g = grupos(chat, contables(chat), 4, "Ana");

  it("da el porcentaje detrás de ti y su parte del grupo", () => {
    const marcela = g.detrasDe.find((d) => d.autor === "Marcela")!;
    expect(marcela.porcentajeDetras).toBeGreaterThan(50);
    expect(marcela.porcentajeGrupo).toBeGreaterThan(0);
    expect(marcela.diferencia).toBe(
      Math.round((marcela.porcentajeDetras - marcela.porcentajeGrupo) * 10) / 10
    );
  });

  it("la diferencia es lo que distingue a quien te contesta de quien solo habla mucho", () => {
    const marcela = g.detrasDe.find((d) => d.autor === "Marcela")!;
    const diego = g.detrasDe.find((d) => d.autor === "Diego")!;
    /* Marcela escribe más detrás de Ana de lo que le tocaría por su peso. */
    expect(marcela.diferencia).toBeGreaterThan(0);
    /* Diego también, y con muchísimo menos volumen en el grupo. */
    expect(diego.diferencia).toBeGreaterThan(0);
    expect(diego.porcentajeGrupo).toBeLessThan(marcela.porcentajeGrupo);
  });

  it("no se calcula si no se pide de nadie", () => {
    expect(grupos(chat, contables(chat), 4).detrasDe).toEqual([]);
  });

  it("con pocos casos no se enseña, que sería ruido", () => {
    const pocos = normalizar([
      ["05/01/26 09:00", "Ana", "a"],
      ["05/01/26 09:02", "Beto", "b"],
      ["05/01/26 10:00", "Ana", "c"],
      ["05/01/26 10:02", "Carla", "d"],
    ]);
    expect(grupos(pocos, contables(pocos), 4, "Ana").detrasDe).toEqual([]);
  });
});
