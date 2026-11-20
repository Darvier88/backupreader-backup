import { describe, expect, it } from "vitest";
import { analizar, VERSION_ANALISIS } from "../../lib/analisis/analizar";
import { AMBIGUO, ANDROID_DIA_PRIMERO, GRUPO, CORTO, chatGrande, filasDe } from "./ejemplos";

describe("analizar", () => {
  const a = analizar(filasDe(ANDROID_DIA_PRIMERO));

  it("trae todas las métricas en un solo resultado", () => {
    for (const clave of [
      "volumen",
      "inicios",
      "respuestas",
      "actividad",
      "tendencias",
      "emojis",
      "palabras",
      "expresiones",
      "grupo",
    ]) {
      expect(a).toHaveProperty(clave);
    }
  });

  it("guarda la versión y los ajustes con los que se calculó", () => {
    expect(a.v).toBe(VERSION_ANALISIS);
    expect(a.ajustes).toEqual({ umbralHoras: 4, medida: "mensajes", idioma: "es" });
    const otro = analizar(filasDe(ANDROID_DIA_PRIMERO), { umbralHoras: 8, medida: "palabras" });
    expect(otro.ajustes.umbralHoras).toBe(8);
    expect(otro.ajustes.medida).toBe("palabras");
    expect(otro.tendencias.medida).toBe("palabras");
  });

  it("dice qué quedó fuera de los conteos", () => {
    expect(a.totalFilas).toBe(7);
    expect(a.mensajesContables).toBe(7);
    expect(a.eliminados).toBe(0);
    expect(a.sistema).toBe(0);
    expect(a.sinFecha).toBe(0);
  });

  it("«suficiente» es que haya algo que contar, no que haya bastante", () => {
    /* Dos personas y dos mensajes ya se pueden contar: lo que no llega lo
       dice `cobertura`, métrica por métrica. */
    expect(analizar(filasDe(CORTO)).suficiente).toBe(true);
    expect(analizar([]).suficiente).toBe(false);
    /* Un monólogo tampoco: no hay a quién comparar con quién. */
    expect(
      analizar([["13/01/26 9:00", "Ana", "hola"], ["13/01/26 9:01", "Ana", "¿hay alguien?"]])
        .suficiente
    ).toBe(false);
  });

  it("dice qué le falta a cada cifra, no solo que falta", () => {
    const corto = analizar(filasDe(CORTO)).cobertura;
    expect(corto.mensajes).toEqual({ tiene: 2, pide: 100, llega: false });
    expect(corto.conversaciones.llega).toBe(false);
    expect(corto.dias.pide).toBe(14);
    expect(corto.meses.pide).toBe(2);

    const grande = analizar(chatGrande(2000)).cobertura;
    expect(grande.mensajes.llega).toBe(true);
    expect(grande.conversaciones.llega).toBe(true);
    expect(grande.dias.llega).toBe(true);
  });

  it("las respuestas se miden por la persona que MENOS tiene", () => {
    /* Con la mediana de uno solo no se puede comparar a nadie. */
    const filas = [
      ["05/01/26 09:00", "Ana", "a"],
      ["05/01/26 10:00", "Beto", "b"],
      ["05/01/26 11:00", "Ana", "c"],
    ];
    const c = analizar(filas, { umbralHoras: 8 }).cobertura;
    expect(c.respuestas.tiene).toBe(1);
    expect(c.respuestas.llega).toBe(false);
  });

  it("el umbral cambia el resultado, no solo la etiqueta", () => {
    const filas = chatGrande(300);
    const corto = analizar(filas, { umbralHoras: 1 });
    const largo = analizar(filas, { umbralHoras: 8 });
    expect(corto.inicios.conversaciones).toBeGreaterThanOrEqual(largo.inicios.conversaciones);
  });

  it("es pura: dos veces lo mismo da lo mismo", () => {
    const filas = filasDe(GRUPO);
    expect(JSON.stringify(analizar(filas))).toBe(JSON.stringify(analizar(filas)));
  });

  it("sobrevive a ida y vuelta por JSON, que es como se guarda", () => {
    const vuelta = JSON.parse(JSON.stringify(a));
    expect(vuelta).toEqual(a);
  });

  it("no mete texto del chat en el resultado: solo cifras e índices", () => {
    const filas = [
      ["13/01/26 9:00", "Ana", "la contraseña del wifi es jirafa-morada-77"],
      ["13/01/26 9:01", "Beto", "gracias"],
    ];
    const r = analizar(filas);
    const json = JSON.stringify(r);
    expect(json).not.toContain("jirafa-morada-77");
    expect(json).not.toContain("contraseña del wifi");
    /* Los ejemplos son posiciones, no frases. */
    expect(r.expresiones.agradecimientos[0].ejemplos).toEqual([1]);
  });

  it("dice qué formato de fecha dedujo y si el chat lo demuestra", () => {
    /* Con un 13 en el día, el chat lo demuestra solo. */
    expect(analizar(filasDe(ANDROID_DIA_PRIMERO)).formatoFecha).toEqual({
      diaPrimero: true,
      seguro: true,
    });
    /* Si todo cae en los doce primeros días del mes, no hay manera: la
       interfaz tiene que avisar antes de enseñar «mes a mes». */
    expect(analizar(filasDe(AMBIGUO)).formatoFecha.seguro).toBe(false);
  });

  it("un chat vacío da un resultado vacío y no una excepción", () => {
    const vacio = analizar([]);
    expect(vacio.mensajesContables).toBe(0);
    expect(vacio.suficiente).toBe(false);
    expect(vacio.desde).toBeNull();
  });
});

describe("rendimiento", () => {
  it("analiza 50.000 mensajes en menos de 10 segundos", () => {
    const filas = chatGrande(50000);
    const empezo = Date.now();
    const r = analizar(filas);
    const ms = Date.now() - empezo;

    expect(r.mensajesContables).toBeGreaterThan(49000);
    /* Lo que se mide aquí es que no se ha colado nada cuadrático. Si esto
       falla, el culpable casi siempre es una búsqueda dentro de un bucle. */
    expect(ms).toBeLessThan(10000);
    console.log(`  50.000 mensajes en ${ms} ms`);
  }, 60000);
});
