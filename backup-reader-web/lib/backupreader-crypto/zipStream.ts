import { ZipReader, BlobReader, BlobWriter, configure } from "@zip.js/zip.js";
import type { FileKind } from "./types";

/**
 * Descompresión de zip EN STREAMING.
 *
 * zip.js lee el índice del zip (pequeño) y extrae cada pieza bajo demanda desde
 * el Blob (respaldado en disco). Así un zip de varios GB se procesa pieza por
 * pieza sin cargarlo entero en memoria.
 */

export interface ZipEntry {
  name: string;
  size: number; // tamaño descomprimido (bytes)
  mime: string; // deducido de la extensión
  /** Extrae SOLO esta pieza del zip y la devuelve como Blob (ya tipado). */
  getBlob: () => Promise<Blob>;
}

export interface OpenZip {
  entries: ZipEntry[];
  close: () => Promise<void>;
}

/**
 * Abre el zip UNA vez y devuelve el índice completo.
 *
 * Importante: hay que llamar a close() al terminar, y los getBlob() solo
 * sirven mientras el zip esté abierto. Antes se abría el zip dos veces (una
 * para contar y otra para procesar), que es leer el índice y descomprimir el
 * directorio central por partida doble.
 */
export async function openZip(zipFile: Blob): Promise<OpenZip> {
  configure({ useWebWorkers: true }); // zip.js descomprime en sus propios workers
  const reader = new ZipReader(new BlobReader(zipFile));
  const raw = await reader.getEntries();

  const entries: ZipEntry[] = raw
    .filter((e) => !e.directory)
    .map((entry) => {
      const mime = mimeFor(entry.filename);
      return {
        name: entry.filename,
        size: entry.uncompressedSize ?? 0,
        mime,
        getBlob: async () => {
          if (!entry.getData) throw new Error(`No se puede extraer ${entry.filename}`);
          // El mime va en el BlobWriter: si no, el Blob sale sin tipo, encryptFile
          // guarda "application/octet-stream" y al reproducir el <img>/<video>
          // no renderiza nada.
          return entry.getData(new BlobWriter(mime));
        },
      };
    });

  return { entries, close: () => reader.close() };
}

/** Compatibilidad con la Fase 0: itera las piezas y cierra el zip al terminar. */
export async function* iterateZip(zipFile: Blob): AsyncGenerator<ZipEntry> {
  const zip = await openZip(zipFile);
  try {
    for (const e of zip.entries) yield e;
  } finally {
    await zip.close();
  }
}

/** Detecta el tipo de pieza por su extensión. */
export function detectKind(name: string): FileKind {
  const ext = extOf(name);
  if (/^(jpg|jpeg|png|gif|webp|bmp|tiff|svg|heic|heif)$/.test(ext)) return "image";
  if (/^(opus|mp3|m4a|aac|ogg|wav|flac|amr)$/.test(ext)) return "audio";
  if (/^(mp4|mov|avi|mkv|3gp|webm|wmv|flv)$/.test(ext)) return "video";
  if (ext === "txt") return "chat";
  return "document";
}

const extOf = (name: string) => (name.split(".").pop() || "").toLowerCase();

const MIME_BY_EXT: Record<string, string> = {
  // imagen
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif",
  webp: "image/webp", bmp: "image/bmp", tiff: "image/tiff", svg: "image/svg+xml",
  heic: "image/heic", heif: "image/heif",
  // audio
  opus: "audio/ogg; codecs=opus", ogg: "audio/ogg", mp3: "audio/mpeg",
  m4a: "audio/mp4", aac: "audio/aac", wav: "audio/wav", flac: "audio/flac",
  amr: "audio/amr",
  // video
  mp4: "video/mp4", mov: "video/quicktime", avi: "video/x-msvideo",
  mkv: "video/x-matroska", webm: "video/webm", "3gp": "video/3gpp",
  wmv: "video/x-ms-wmv", flv: "video/x-flv",
  // texto / documento
  txt: "text/plain; charset=utf-8", json: "application/json",
  csv: "text/csv", pdf: "application/pdf",
  vcf: "text/vcard", html: "text/html",
};

/** Mime type a partir de la extensión (WhatsApp no guarda metadatos de tipo). */
export function mimeFor(name: string): string {
  return MIME_BY_EXT[extOf(name)] || "application/octet-stream";
}
