import { describe, expect, it } from "vitest";

import { analizar } from "../../lib/analisis/analizar";
import { normalizar } from "../../lib/analisis/normalizar";
import { media } from "../../lib/analisis/media";
import { parsearInstagram } from "../../lib/parsear-instagram";

/**
 * Lo que se compartió, contado sobre un chat de Instagram.
 *
 * Dos cosas se cuentan distinto que en WhatsApp, y ninguna es un capricho:
 *
 * 1. UN AUDIO ES UNA NOTA DE VOZ. Por los mensajes directos de Instagram no
 *    se pueden mandar archivos de audio, solo grabar; una canción compartida
 *    viaja como enlace. En WhatsApp hay que mirar si el archivo se llama
 *    «PTT-…», porque ahí sí se pueden mandar las dos cosas.
 * 2. UN STICKER NO ES UNA FOTO. Los dos los guardan en .webp, y la regla que
 *    traducía extensión a tipo tenía «imagen» antes que «sticker», así que la
 *    de sticker no se cumplía nunca.
 */

const RUTA = "your_instagram_activity/messages/inbox/ana_123";

const mensaje = (quien: string, ms: number, extra: Record<string, unknown> = {}) => ({
  sender_name: quien,
  timestamp_ms: ms,
  ...extra,
});

const CHAT = [
  mensaje("Ana", 1_000, { content: "hola" }),
  mensaje("Ana", 2_000, { photos: [{ uri: `${RUTA}/photos/1.jpg` }] }),
  mensaje("Beto", 3_000, { photos: [{ uri: `${RUTA}/photos/2.jpg` }] }),
  mensaje("Beto", 4_000, { audio_files: [{ uri: `${RUTA}/audio/a1.m4a` }] }),
  mensaje("Ana", 5_000, { audio_files: [{ uri: `${RUTA}/audio/a2.m4a` }] }),
  mensaje("Ana", 6_000, { videos: [{ uri: `${RUTA}/videos/v.mp4` }] }),
  mensaje("Beto", 7_000, { sticker: { uri: `${RUTA}/stickers/s.webp` } }),
  mensaje("Beto", 8_000, { content: "mira https://www.instagram.com/p/abc/" }),
];

const cuenta = (origen?: string) => {
  const filas = parsearInstagram({ messages: CHAT });
  const { mensajes } = normalizar(filas);
  const m = media(mensajes, origen);
  return Object.fromEntries(m.filas.map((f) => [f.clase, f.total]));
};

describe("lo compartido en un chat de Instagram", () => {
  it("cuenta cada clase por separado", () => {
    expect(cuenta("instagram")).toEqual({
      fotos: 2,
      "notas de voz": 2,
      vídeos: 1,
      stickers: 1,
      enlaces: 1,
    });
  });

  it("los audios son notas de voz, sin mirar el nombre del archivo", () => {
    /* En WhatsApp, un archivo que no empieza por «PTT-» es un audio
       compartido. En Instagram no existe esa posibilidad. */
    expect(cuenta("instagram")["notas de voz"]).toBe(2);
    expect(cuenta("whatsapp")["audios"]).toBe(2);
    expect(cuenta("whatsapp")["notas de voz"]).toBeUndefined();
  });

  it("un sticker no se cuenta como foto", () => {
    /* Con la regla anterior, el .webp caía en «imagen» y aquí habría 3
       fotos y ningún sticker. */
    expect(cuenta("instagram").fotos).toBe(2);
    expect(cuenta("instagram").stickers).toBe(1);
  });

  it("dice quién compartió cada cosa", () => {
    const filas = parsearInstagram({ messages: CHAT });
    const { mensajes } = normalizar(filas);
    const fotos = media(mensajes, "instagram").filas.find((f) => f.clase === "fotos")!;
    expect(fotos.porAutor).toEqual({ Ana: 1, Beto: 1 });
  });
});

describe("el análisis completo de un chat de Instagram", () => {
  it("lleva el conteo y respeta el origen", () => {
    const filas = parsearInstagram({ messages: CHAT });
    const a = analizar(filas, { origen: "instagram", idioma: "es" });

    expect(a.media.total).toBe(7);
    expect(a.media.filas.find((f) => f.clase === "notas de voz")?.total).toBe(2);
    /* Con los archivos delante, no sale el aviso de «export sin archivos». */
    expect(a.media.sinArchivos).toBe(false);
  });

  it("sin decir el origen se cuenta como hasta ahora", () => {
    const filas = parsearInstagram({ messages: CHAT });
    const a = analizar(filas, { idioma: "es" });
    expect(a.media.filas.find((f) => f.clase === "audios")?.total).toBe(2);
  });
});

describe("las fechas de Instagram no son ambiguas", () => {
  it("con el año delante no hay nada que preguntar", () => {
    /* Esto bloqueaba el panel entero: el análisis se quedaba esperando a que
       alguien confirmara si «03/04» era marzo o abril, en un chat donde las
       fechas vienen como «2026-03-01» y no hay ninguna duda. */
    const filas = parsearInstagram({ messages: CHAT });
    const a = analizar(filas, { origen: "instagram", idioma: "es" });
    expect(a.formatoFecha.seguro).toBe(true);
  });

  it("un chat de WhatsApp sin pruebas sigue preguntando", () => {
    /* El respaldo no cambia: «3/4/26» puede ser cualquiera de las dos cosas,
       y ahí sí hay que preguntar. */
    const filas = [
      ["3/4/26 10:00", "Ana", "hola"],
      ["4/4/26 10:01", "Beto", "qué tal"],
    ];
    expect(analizar(filas, { idioma: "es" }).formatoFecha.seguro).toBe(false);
  });
});
