import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

import {
  necesitaConversion,
  pcmAWav,
  convertirOpusAWav,
  prepararAudio,
} from "../../lib/audio/opusFallback";

/**
 * Respaldo de Opus (Etapa 7).
 *
 * El archivo `tests/audio/muestra.opus` es un tono de 440 Hz de 2 s generado
 * con ffmpeg. Sirve para comprobar que la conversión produce audio real y no
 * solo un WAV con la cabecera bien puesta.
 */

const MUESTRA = resolve(__dirname, "muestra.opus");

const leerMuestra = () =>
  new Blob([new Uint8Array(readFileSync(MUESTRA)) as BlobPart], {
    type: "audio/ogg; codecs=opus",
  });

/** Lee la cabecera de un WAV para poder comprobarla campo a campo. */
function cabeceraWav(buf: ArrayBuffer) {
  const v = new DataView(buf);
  const txt = (o: number, n: number) =>
    String.fromCharCode(...new Uint8Array(buf, o, n));
  return {
    riff: txt(0, 4),
    wave: txt(8, 4),
    fmt: txt(12, 4),
    formato: v.getUint16(20, true),
    canales: v.getUint16(22, true),
    sampleRate: v.getUint32(24, true),
    bitsPorMuestra: v.getUint16(34, true),
    data: txt(36, 4),
    dataBytes: v.getUint32(40, true),
  };
}

describe("cuándo hace falta convertir", () => {
  it("solo con Opus y sin soporte nativo", () => {
    // El navegador no sabe: hay que convertir.
    expect(necesitaConversion("audio/ogg; codecs=opus", "a.opus", false)).toBe(true);
    // El navegador sí sabe: no se toca nada (ni se carga el decodificador).
    expect(necesitaConversion("audio/ogg; codecs=opus", "a.opus", true)).toBe(false);
  });

  it("detecta el Opus por la extensión aunque el mime sea genérico", () => {
    expect(necesitaConversion("application/octet-stream", "AUDIO-01.OPUS", false)).toBe(true);
  });

  it("no toca otros formatos", () => {
    for (const [mime, nombre] of [
      ["audio/mpeg", "a.mp3"],
      ["image/jpeg", "foto.jpg"],
      ["video/mp4", "v.mp4"],
      ["audio/mp4", "a.m4a"],
    ]) {
      expect(necesitaConversion(mime, nombre, false)).toBe(false);
    }
  });
});

describe("empaquetado WAV", () => {
  it("escribe una cabecera correcta", async () => {
    const muestras = new Float32Array(1000).fill(0.5);
    const wav = pcmAWav([muestras], 48000);
    const h = cabeceraWav(await wav.arrayBuffer());

    expect(wav.type).toBe("audio/wav");
    expect(h.riff).toBe("RIFF");
    expect(h.wave).toBe("WAVE");
    expect(h.fmt).toBe("fmt ");
    expect(h.formato).toBe(1);        // PCM sin comprimir
    expect(h.canales).toBe(1);
    expect(h.sampleRate).toBe(48000);
    expect(h.bitsPorMuestra).toBe(16);
    expect(h.data).toBe("data");
    expect(h.dataBytes).toBe(1000 * 2);
    expect(wav.size).toBe(44 + 1000 * 2);
  });

  it("intercala los canales en estéreo", async () => {
    const izq = new Float32Array([1, 1, 1]);
    const der = new Float32Array([-1, -1, -1]);
    const wav = pcmAWav([izq, der], 48000);
    const buf = await wav.arrayBuffer();
    const h = cabeceraWav(buf);

    expect(h.canales).toBe(2);
    expect(h.dataBytes).toBe(3 * 2 * 2); // 3 muestras x 2 canales x 2 bytes

    const v = new DataView(buf);
    expect(v.getInt16(44, true)).toBe(32767);   // izquierdo
    expect(v.getInt16(46, true)).toBe(-32768);  // derecho
  });

  it("recorta los valores fuera de rango en vez de desbordar", async () => {
    const wav = pcmAWav([new Float32Array([5, -5])], 48000);
    const v = new DataView(await wav.arrayBuffer());
    expect(v.getInt16(44, true)).toBe(32767);
    expect(v.getInt16(46, true)).toBe(-32768);
  });
});

describe("conversión de un Opus real", () => {
  it("produce un WAV con la duración y el tono correctos", async () => {
    const wav = await convertirOpusAWav(leerMuestra());
    const buf = await wav.arrayBuffer();
    const h = cabeceraWav(buf);

    expect(wav.type).toBe("audio/wav");
    expect(h.sampleRate).toBe(48000);
    expect(h.canales).toBe(1);

    // La muestra dura 2 s: 96 000 muestras a 48 kHz.
    const muestras = h.dataBytes / 2;
    expect(muestras).toBe(96000);

    /* Y que suene: contar cruces por cero da la frecuencia fundamental.
       Un WAV con la cabecera bien puesta pero silencio o ruido no pasaría. */
    const pcm = new Int16Array(buf, 44, muestras);
    const tramo = pcm.subarray(4800, 91200);
    let cruces = 0;
    for (let i = 1; i < tramo.length; i++) {
      if (tramo[i - 1] < 0 !== tramo[i] < 0) cruces++;
    }
    const hz = cruces / 2 / (tramo.length / 48000);
    expect(hz).toBeGreaterThan(435);
    expect(hz).toBeLessThan(445);
  }, 30000);

  it("un archivo corrupto devuelve el original en vez de reventar", async () => {
    const basura = new Blob([new Uint8Array([1, 2, 3, 4, 5]) as BlobPart]);
    const r = await convertirOpusAWav(basura);
    expect(r.size).toBe(5);
  }, 30000);
});

describe("prepararAudio", () => {
  it("no toca el blob cuando no hace falta", async () => {
    const original = new Blob([new Uint8Array(100) as BlobPart], { type: "audio/mpeg" });
    const r = await prepararAudio(original, "audio/mpeg", "a.mp3");
    // Mismo objeto: ni se copia ni se carga el decodificador.
    expect(r).toBe(original);
  });
});
