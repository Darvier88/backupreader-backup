/**
 * Respaldo de reproducción para audio Opus (Etapa 7).
 *
 * WhatsApp exporta las notas de voz como Ogg Opus, y Safari de la versión 11 a
 * la 18.3 solo entiende Opus dentro de un contenedor CAF. Es decir: en buena
 * parte de los iPhone y Mac, un <audio> con Ogg Opus no suena.
 *
 * Antes de E2EE esto no se notaba porque la Cloud Function `unzip` convertía
 * cada .opus a .mp3 en el servidor. Con cifrado de extremo a extremo el
 * servidor no puede leer nada, así que la conversión tiene que ocurrir aquí.
 *
 * Coste: el decodificador son ~118 KB de JavaScript con el WASM incrustado.
 * Por eso se carga de forma diferida y SOLO cuando el navegador no sabe
 * reproducir Opus por su cuenta. En Chrome y en Android no se descarga nunca.
 *
 * Importante: la dependencia está fijada a `ogg-opus-decoder@1.6.16`. A partir
 * de la 1.7 arrastra `@wasm-audio-decoders/opus-ml`, que lleva el bundle de
 * 118 KB a 4 MB sin aportar nada para este caso.
 */

/** Resultado de la detección, cacheado: no cambia durante la sesión. */
let soporteNativo: boolean | null = null;

/**
 * ¿Sabe este navegador reproducir Ogg Opus directamente?
 *
 * `canPlayType` devuelve "probably", "maybe" o la cadena vacía. Solo la cadena
 * vacía es un "no" claro; "maybe" se trata como un sí, porque el coste de
 * equivocarse es cargar el respaldo sin necesidad, no que el audio falle.
 *
 * En el servidor (sin `document`) se asume que sí: no hay que cargar nada
 * durante el render de servidor.
 */
export function soportaOpusNativo(): boolean {
  if (soporteNativo !== null) return soporteNativo;
  if (typeof document === "undefined") return (soporteNativo = true);

  const a = document.createElement("audio");
  soporteNativo = a.canPlayType('audio/ogg; codecs="opus"') !== "";
  return soporteNativo;
}

/**
 * ¿Hace falta convertir este archivo para poder reproducirlo?
 *
 * `soporta` se puede inyectar para poder probar los dos caminos sin navegador.
 */
export function necesitaConversion(
  mime: string,
  nombre: string,
  soporta: boolean = soportaOpusNativo()
): boolean {
  const esOpus =
    (mime || "").toLowerCase().includes("opus") ||
    (nombre || "").toLowerCase().endsWith(".opus");
  return esOpus && !soporta;
}

/**
 * Empaqueta PCM en un WAV de 16 bits.
 *
 * WAV porque lo reproduce absolutamente todo, incluido el Safari que no
 * entiende Opus. El precio es el tamaño: sin comprimir ocupa unas 19 veces más
 * que el Opus original, así que una nota de voz de dos minutos ronda los 11 MB.
 * Se queda en memoria como object URL y no se descarga, de modo que es
 * asumible; la política de 300 MiB de `canPlayInline` sigue cubriendo los
 * casos extremos.
 */
export function pcmAWav(canales: Float32Array[], sampleRate: number): Blob {
  const numCanales = canales.length;
  const numMuestras = canales[0]?.length ?? 0;
  const bytesPorMuestra = 2;
  const blockAlign = numCanales * bytesPorMuestra;
  const dataBytes = numMuestras * blockAlign;

  const buffer = new ArrayBuffer(44 + dataBytes);
  const vista = new DataView(buffer);

  const texto = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) vista.setUint8(offset + i, s.charCodeAt(i));
  };

  texto(0, "RIFF");
  vista.setUint32(4, 36 + dataBytes, true);
  texto(8, "WAVE");
  texto(12, "fmt ");
  vista.setUint32(16, 16, true);          // tamaño del bloque fmt
  vista.setUint16(20, 1, true);           // 1 = PCM sin comprimir
  vista.setUint16(22, numCanales, true);
  vista.setUint32(24, sampleRate, true);
  vista.setUint32(28, sampleRate * blockAlign, true);
  vista.setUint16(32, blockAlign, true);
  vista.setUint16(34, 8 * bytesPorMuestra, true);
  texto(36, "data");
  vista.setUint32(40, dataBytes, true);

  // Intercalado de canales y conversión de float [-1,1] a entero de 16 bits.
  let offset = 44;
  for (let i = 0; i < numMuestras; i++) {
    for (let c = 0; c < numCanales; c++) {
      let m = canales[c][i];
      m = m < -1 ? -1 : m > 1 ? 1 : m;
      vista.setInt16(offset, m < 0 ? m * 0x8000 : m * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([buffer as BlobPart], { type: "audio/wav" });
}

/**
 * Convierte un Ogg Opus en un WAV reproducible.
 *
 * Si el decodificador no se puede cargar, o el archivo está corrupto, o no
 * produce audio, devuelve el blob ORIGINAL sin tocar. Es preferible que el
 * navegador intente reproducirlo y falle a que la interfaz se rompa: el
 * mensaje seguirá ahí y el resto del chat funcionará.
 */
export async function convertirOpusAWav(blob: Blob): Promise<Blob> {
  let decodificador: any = null;
  try {
    /* Import diferido: los KB del WASM no entran en el bundle principal ni se
       descargan en los navegadores que no los necesitan. */
    const { OggOpusDecoder } = await import("ogg-opus-decoder");
    decodificador = new OggOpusDecoder();
    await decodificador.ready;

    const bytes = new Uint8Array(await blob.arrayBuffer());
    const { channelData, sampleRate, samplesDecoded } =
      await decodificador.decodeFile(bytes);

    if (!samplesDecoded || !channelData?.length) {
      console.warn("El archivo Opus no produjo audio; se deja tal cual.");
      return blob;
    }

    return pcmAWav(channelData, sampleRate);
  } catch (error) {
    console.warn("No se pudo convertir el Opus; se deja tal cual.", error);
    return blob;
  } finally {
    try {
      decodificador?.free();
    } catch {
      /* liberar el WASM es best-effort */
    }
  }
}

/**
 * Punto de entrada para quien resuelve media: convierte si hace falta, y si no,
 * devuelve el blob sin tocarlo ni cargar nada.
 */
export async function prepararAudio(
  blob: Blob,
  mime: string,
  nombre: string
): Promise<Blob> {
  if (!necesitaConversion(mime, nombre)) return blob;
  return convertirOpusAWav(blob);
}
