import { describe, it, expect } from "vitest";

import {
  partirPorCoincidencias,
  contiene,
  cuantasVeces,
  fragmentoAlrededor,
} from "../../lib/busqueda/resaltar";

/**
 * Resaltar lo buscado dentro de un mensaje.
 *
 * Lo que de verdad se comprueba aquí es que los índices no se descoloquen con
 * las tildes. Resaltar el trozo equivocado no rompe nada visiblemente —no hay
 * excepción, no hay pantalla en blanco—, solo se subraya la palabra de al
 * lado, y eso puede pasar inadvertido mucho tiempo.
 */

/** Junta los trozos otra vez, para comprobar que no se perdió texto. */
const rehacer = (trozos: { texto: string }[]) => trozos.map((t) => t.texto).join("");

describe("partirPorCoincidencias", () => {
  it("parte el texto dejando la coincidencia aparte", () => {
    const t = partirPorCoincidencias("¿Ya enviaste los documentos?", "documentos");
    expect(t.filter((x) => x.coincide)).toHaveLength(1);
    expect(t.find((x) => x.coincide)!.texto).toBe("documentos");
  });

  it("NUNCA pierde ni inventa texto", () => {
    /* Si los trozos no suman el original, se está pintando mal el mensaje. */
    const frases = [
      "¿Ya enviaste los documentos para la postulación?",
      "Mañana le digo a mamá que trajo los documentos",
      "DOCUMENTOS documentos DoCuMeNtOs",
      "",
      "sin coincidencia aquí",
    ];
    for (const f of frases) {
      expect(rehacer(partirPorCoincidencias(f, "documentos"))).toBe(f);
    }
  });

  it("LAS TILDES NO DESCOLOCAN EL RESALTADO", () => {
    /* El caso que motivó todo esto. Con tildes antes de la coincidencia, una
       normalización que no guarde el mapa corre las posiciones y subraya la
       palabra equivocada, sin fallar por ningún lado. */
    const texto = "ácaro ñandú café → documentos aquí";
    const trozos = partirPorCoincidencias(texto, "documentos");

    expect(rehacer(trozos)).toBe(texto);
    const marcado = trozos.find((t) => t.coincide)!;
    expect(marcado.texto).toBe("documentos");
  });

  it("resalta la palabra con tilde cuando se busca sin ella", () => {
    const trozos = partirPorCoincidencias("se lo dije a mamá ayer", "mama");
    const marcado = trozos.find((t) => t.coincide)!;
    /* Lo que se pinta es el original CON tilde, no la versión normalizada. */
    expect(marcado.texto).toBe("mamá");
    expect(rehacer(trozos)).toBe("se lo dije a mamá ayer");
  });

  it("numera las coincidencias en orden", () => {
    const t = partirPorCoincidencias("documentos y más documentos y documentos", "documentos");
    const marcados = t.filter((x) => x.coincide);
    expect(marcados.map((m) => m.indice)).toEqual([0, 1, 2]);
  });

  it("ignora mayúsculas", () => {
    const t = partirPorCoincidencias("Los DOCUMENTOS llegaron", "documentos");
    expect(t.find((x) => x.coincide)!.texto).toBe("DOCUMENTOS");
  });

  it("la ñ no es una n: buscar 'ano' no encuentra 'año'", () => {
    expect(contiene("cumple años", "ano")).toBe(false);
    expect(contiene("el ano del documento", "ano")).toBe(true);
  });

  it("con menos de dos letras no resalta nada", () => {
    /* Coincidiría con casi todo y dejaría el mensaje lleno de marcas. */
    const t = partirPorCoincidencias("hola que tal", "a");
    expect(t).toHaveLength(1);
    expect(t[0].coincide).toBe(false);
  });

  it("sin coincidencias devuelve el texto de una pieza", () => {
    const t = partirPorCoincidencias("hola que tal", "bicicleta");
    expect(t).toHaveLength(1);
    expect(t[0].texto).toBe("hola que tal");
  });

  it("aguanta texto vacío sin reventar", () => {
    expect(partirPorCoincidencias("", "hola")[0].texto).toBe("");
    expect(rehacer(partirPorCoincidencias("hola", ""))).toBe("hola");
  });
});

describe("cuantasVeces", () => {
  it("cuenta todas las apariciones", () => {
    expect(cuantasVeces("documentos, documentos y documentos", "documentos")).toBe(3);
    expect(cuantasVeces("nada que ver", "documentos")).toBe(0);
  });

  it("cuenta las que llevan tilde al buscar sin ella", () => {
    expect(cuantasVeces("mamá y mama", "mama")).toBe(2);
  });
});

describe("fragmentoAlrededor", () => {
  it("recorta ALREDEDOR de la coincidencia, no por el principio", () => {
    /* Cortar por el principio dejaría fuera justo la palabra buscada, que es
       lo único que el usuario quería ver. */
    const largo = "a".repeat(200) + " documentos " + "b".repeat(200);
    const frag = fragmentoAlrededor(largo, "documentos");

    expect(frag).toContain("documentos");
    expect(frag.length).toBeLessThan(120);
    expect(frag.startsWith("…")).toBe(true);
    expect(frag.endsWith("…")).toBe(true);
  });

  it("un mensaje corto se devuelve entero, sin puntos suspensivos", () => {
    const frag = fragmentoAlrededor("mandé los documentos", "documentos");
    expect(frag).toBe("mandé los documentos");
  });
});
