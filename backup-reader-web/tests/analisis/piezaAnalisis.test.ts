import { describe, expect, it } from "vitest";
import {
  ID_PIEZA_ANALISIS,
  abrirAnalisis,
  analisisVigente,
  empaquetarAnalisis,
  guardarAnalisis,
  rutaDelAnalisis,
  type AnalisisGuardado,
} from "../../lib/analisis/piezaAnalisis";
import { analizar, VERSION_ANALISIS } from "../../lib/analisis/analizar";
import { chatGrande } from "./ejemplos";

const BACKUP = "backup-1";
const dek = () => new Uint8Array(32).fill(7);

const guardado = (): AnalisisGuardado => ({
  v: VERSION_ANALISIS,
  analisis: analizar(chatGrande(200)),
  yo: "Ana",
  cuando: Date.now(),
});

describe("la pieza del análisis", () => {
  it("va donde van las demás piezas, con un id que no es un UUID", () => {
    expect(ID_PIEZA_ANALISIS).toBe("ana");
    expect(rutaDelAnalisis("u1", BACKUP)).toBe(`backups/u1/${BACKUP}/p/ana`);
  });

  it("da la vuelta entera: se cifra y se vuelve a leer igual", async () => {
    const original = guardado();
    const blob = await empaquetarAnalisis(original, dek(), BACKUP);
    const vuelta = await abrirAnalisis(blob, dek(), BACKUP);
    expect(vuelta).toEqual(original);
  });

  it("guarda quién eres tú dentro de la pieza cifrada", async () => {
    const blob = await empaquetarAnalisis(guardado(), dek(), BACKUP);
    expect((await abrirAnalisis(blob, dek(), BACKUP))!.yo).toBe("Ana");
  });

  it("no se puede abrir con otra clave", async () => {
    const blob = await empaquetarAnalisis(guardado(), dek(), BACKUP);
    const otra = new Uint8Array(32).fill(9);
    expect(await abrirAnalisis(blob, otra, BACKUP)).toBeNull();
  });

  it("no se puede colar el análisis de un backup en otro", async () => {
    /* El AAD lleva el backupId, así que ni el servidor puede moverla. */
    const blob = await empaquetarAnalisis(guardado(), dek(), BACKUP);
    expect(await abrirAnalisis(blob, dek(), "otro-backup")).toBeNull();
  });

  it("un blob corrupto devuelve null en vez de reventar", async () => {
    const basura = new Blob([new Uint8Array(64)]);
    expect(await abrirAnalisis(basura, dek(), BACKUP)).toBeNull();
  });

  it("sube la pieza y avisa de lo que ocupa", async () => {
    const subidas: Array<{ ruta: string; bytes: number }> = [];
    let anotado = -1;
    const bytes = await guardarAnalisis({
      uid: "u1",
      backupId: BACKUP,
      guardado: guardado(),
      dek: dek(),
      subir: async (ruta, blob) => {
        subidas.push({ ruta, bytes: blob.size });
      },
      anotarTamano: async (b) => {
        anotado = b;
      },
    });

    expect(subidas).toHaveLength(1);
    expect(subidas[0].ruta).toBe(`backups/u1/${BACKUP}/p/ana`);
    expect(anotado).toBe(bytes);
    expect(bytes).toBeGreaterThan(0);
  });
});

describe("analisisVigente", () => {
  const ajustes = { umbralHoras: 4, medida: "mensajes" as const, idioma: "es" };

  it("sirve si la versión y los ajustes son los mismos", () => {
    const g = guardado();
    expect(analisisVigente(g, g.analisis.ajustes)).toBe(true);
  });

  it("no sirve si cambió el umbral", () => {
    expect(analisisVigente(guardado(), { ...ajustes, umbralHoras: 8 })).toBe(false);
  });

  it("no sirve si cambió la medida o el idioma", () => {
    expect(analisisVigente(guardado(), { ...ajustes, medida: "palabras" })).toBe(false);
    expect(analisisVigente(guardado(), { ...ajustes, idioma: "en" })).toBe(false);
  });

  it("no sirve si es de otra versión del formato", () => {
    const viejo = { ...guardado(), v: VERSION_ANALISIS - 1 };
    expect(analisisVigente(viejo, ajustes)).toBe(false);
  });

  it("sin nada guardado, no sirve", () => {
    expect(analisisVigente(null, ajustes)).toBe(false);
  });
});
