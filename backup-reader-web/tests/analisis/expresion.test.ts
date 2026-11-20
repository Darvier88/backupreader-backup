import { describe, expect, it } from "vitest";
import { contables, normalizar } from "../../lib/analisis/normalizar";
import { emojis, emojisDe } from "../../lib/analisis/emojis";
import { palabrasFrecuentes, partirEnPalabras } from "../../lib/analisis/palabrasFrecuentes";
import { esRuido } from "../../lib/analisis/stopwords";
import { disculpasYAgradecimientos } from "../../lib/analisis/disculpasYAgradecimientos";
import { EMOJIS, filasDe } from "./ejemplos";

const mensajesDe = (filas: string[][]) => contables(normalizar(filas));

describe("emojisDe", () => {
  it("un emoji con tono de piel es uno, no dos", () => {
    expect(emojisDe("👍🏽")).toEqual(["👍🏽"]);
  });

  it("una familia unida por invisibles es un emoji", () => {
    expect(emojisDe("👨‍👩‍👧")).toEqual(["👨‍👩‍👧"]);
  });

  it("una bandera es un emoji", () => {
    expect(emojisDe("🇪🇸")).toEqual(["🇪🇸"]);
  });

  it("no cuenta letras, números ni puntuación", () => {
    expect(emojisDe("hola 123 ¿qué tal?")).toEqual([]);
  });

  it("los saca en orden y repetidos", () => {
    expect(emojisDe("😂 vale 😂 ya")).toEqual(["😂", "😂"]);
  });

  it("junta «❤» y «❤️», que solo cambian en un invisible", () => {
    expect(emojisDe("❤️")).toEqual(emojisDe("❤"));
  });

  it("un texto vacío no da nada", () => {
    expect(emojisDe("")).toEqual([]);
  });
});

describe("emojis", () => {
  const e = emojis(mensajesDe(filasDe(EMOJIS)));

  it("cuenta los compuestos como uno cada uno", () => {
    expect(e.total).toBe(4); /* 👍🏽, 👨‍👩‍👧, 😂, 😂 */
    expect(e.top.find((x) => x.emoji === "😂")!.total).toBe(2);
  });

  it("guarda quién usa cada uno", () => {
    expect(e.top.find((x) => x.emoji === "👨‍👩‍👧")!.porAutor).toEqual({ Beto: 1 });
  });

  it("saca el favorito de cada persona", () => {
    expect(e.favoritoPorAutor.Ana).toBe("😂");
    expect(e.favoritoPorAutor.Beto).toBe("👨‍👩‍👧");
  });

  it("guarda un mensaje de ejemplo para poder ir a verlo", () => {
    const fila = e.top.find((x) => x.emoji === "👍🏽")!;
    expect(typeof fila.ejemplo).toBe("number");
    expect(fila.ejemplo).toBeGreaterThanOrEqual(0);
  });

  it("no mira el nombre del archivo de un adjunto", () => {
    const m = mensajesDe([["13/01/26 9:00", "Ana", "foto-😀.jpg (archivo adjunto)"]]);
    expect(emojis(m).total).toBe(0);
  });

  it("sin mensajes no se rompe", () => {
    expect(emojis([]).total).toBe(0);
  });
});

describe("esRuido", () => {
  it("quita las palabras que salen en todos los chats", () => {
    expect(esRuido("que")).toBe(true);
    expect(esRuido("the")).toBe(true);
    expect(esRuido("vale")).toBe(true);
  });

  it("no le importan las tildes", () => {
    expect(esRuido("más")).toBe(true);
    expect(esRuido("está")).toBe(true);
    expect(esRuido("aquí")).toBe(true);
  });

  it("quita risas de cualquier largo", () => {
    expect(esRuido("jajaja")).toBe(true);
    expect(esRuido("jajajajaja")).toBe(true);
    expect(esRuido("hahaha")).toBe(true);
    expect(esRuido("kkkkk")).toBe(true);
  });

  it("quita números sueltos y palabras de una o dos letras", () => {
    expect(esRuido("2026")).toBe(true);
    expect(esRuido("tú")).toBe(true);
  });

  it("deja pasar lo que sí dice algo de este chat", () => {
    expect(esRuido("cumpleaños")).toBe(false);
    expect(esRuido("presupuesto")).toBe(false);
    expect(esRuido("niña")).toBe(false);
  });
});

describe("partirEnPalabras", () => {
  it("separa palabras y deja fuera la puntuación", () => {
    expect(partirEnPalabras("Hola, ¿qué tal?")).toEqual(["hola", "qué", "tal"]);
  });

  it("deja fuera los emojis", () => {
    expect(partirEnPalabras("vale 😂")).toEqual(["vale"]);
  });
});

describe("palabrasFrecuentes", () => {
  const filas = [
    ["13/01/26 9:00", "Ana", "el presupuesto del viaje está listo"],
    ["13/01/26 9:01", "Beto", "qué bien, ¿y el viaje cuándo es?"],
    ["13/01/26 9:02", "Ana", "el viaje es en julio, ya tengo el presupuesto"],
    ["13/01/26 9:03", "Beto", "IMG-20260113-WA0001.jpg (archivo adjunto)"],
  ];
  const p = palabrasFrecuentes(mensajesDe(filas));

  it("deja arriba lo que distingue al chat, no «el» ni «que»", () => {
    expect(p.top[0].palabra).toBe("viaje");
    expect(p.top.map((x) => x.palabra)).not.toContain("el");
    expect(p.top.map((x) => x.palabra)).not.toContain("que");
  });

  it("cuenta por persona", () => {
    expect(p.top[0].porAutor).toEqual({ Ana: 2, Beto: 1 });
  });

  it("no cuenta el nombre de un archivo adjunto", () => {
    const palabras = p.top.map((x) => x.palabra);
    expect(palabras.some((w) => /img|jpg|adjunto/i.test(w))).toBe(false);
  });

  it("guarda un ejemplo por palabra", () => {
    expect(p.top[0].ejemplo).toBe(0);
  });

  it("respeta el tamaño que se le pide", () => {
    expect(palabrasFrecuentes(mensajesDe(filas), { cuantas: 1 }).top).toHaveLength(1);
  });

  it("sin mensajes devuelve una lista vacía", () => {
    expect(palabrasFrecuentes([]).top).toEqual([]);
  });
});

describe("disculpasYAgradecimientos", () => {
  const filas = [
    ["13/01/26 9:00", "Ana", "perdona, iba en el metro"],
    ["13/01/26 9:01", "Beto", "nada, gracias por avisar"],
    ["13/01/26 9:02", "Ana", "lo siento de verdad, perdón"],
    ["13/01/26 9:03", "Beto", "muchas graciasss"],
    ["13/01/26 9:04", "Ana", "qué gracioso eres"],
    ["13/01/26 9:05", "Beto", "sorry, me despisté"],
  ];
  const r = disculpasYAgradecimientos(mensajesDe(filas));

  it("cuenta las disculpas de cada uno", () => {
    const ana = r.disculpas.find((d) => d.autor === "Ana")!;
    expect(ana.total).toBe(3); /* perdona, lo siento, perdón */
    expect(r.disculpas.find((d) => d.autor === "Beto")!.total).toBe(1);
  });

  it("«gracioso» no es «gracias»", () => {
    const ana = r.agradecimientos.find((a) => a.autor === "Ana");
    expect(ana).toBeUndefined();
  });

  it("aguanta las letras de más", () => {
    expect(r.agradecimientos.find((a) => a.autor === "Beto")!.total).toBe(2);
  });

  it("«muchas gracias» es una vez, no dos", () => {
    const uno = disculpasYAgradecimientos(
      mensajesDe([["13/01/26 9:00", "Ana", "muchas gracias"]])
    );
    expect(uno.totalAgradecimientos).toBe(1);
  });

  it("da la proporción por cada cien mensajes", () => {
    const ana = r.disculpas.find((d) => d.autor === "Ana")!;
    /* 3 de 3 mensajes suyos */
    expect(ana.porCienMensajes).toBe(100);
  });

  it("guarda ejemplos para poder abrirlos", () => {
    expect(r.disculpas.find((d) => d.autor === "Ana")!.ejemplos.length).toBeGreaterThan(0);
  });

  it("no cuenta nada en un chat sin ninguna de las dos cosas", () => {
    const vacio = disculpasYAgradecimientos(
      mensajesDe([["13/01/26 9:00", "Ana", "vamos al cine"]])
    );
    expect(vacio.totalDisculpas).toBe(0);
    expect(vacio.totalAgradecimientos).toBe(0);
  });
});
