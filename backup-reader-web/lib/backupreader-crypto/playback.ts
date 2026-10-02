import { INLINE_PLAYBACK_MAX_BYTES, CHUNK_SIZE } from "./constants";
import { decryptFile } from "./fileCipher";
import type { FileKind } from "./types";

/**
 * Política de reproducción (separada de la de cifrado):
 *   - Hasta INLINE_PLAYBACK_MAX_BYTES (300 MiB) → se puede reproducir/mostrar
 *     directamente en el navegador (object URL en <img>/<audio>/<video>).
 *   - Por encima → NO reproducir inline (congela la pantalla en móvil);
 *     ofrecer descarga o streaming por Service Worker.
 */
export function canPlayInline(sizeBytes: number): boolean {
  return sizeBytes <= INLINE_PLAYBACK_MAX_BYTES;
}

export interface DecryptedMedia {
  blob: Blob;
  objectUrl: string;
  kind: FileKind;
  /** true si conviene reproducir directo; false si es mejor descargar/stream. */
  inlinePlayable: boolean;
}

/**
 * Descifra un archivo para verlo. Devuelve el Blob, un object URL y si conviene
 * reproducirlo inline.
 *
 * IMPORTANTE: revocar el objectUrl con URL.revokeObjectURL cuando ya no se use.
 * En la app eso va en el cleanup del useEffect; si no, un chat largo con lazy
 * loading va acumulando blobs descifrados en memoria hasta que revienta.
 */
export async function decryptForPlayback(
  header: Uint8Array,
  ciphertext: Blob,
  dek: Uint8Array,
  kind: FileKind,
  mimeType: string,
  opts: { aad?: string; blockSize?: number } = {}
): Promise<DecryptedMedia> {
  const blob = await decryptFile(header, ciphertext, dek, mimeType, {
    aad: opts.aad,
    blockSize: opts.blockSize ?? CHUNK_SIZE,
  });
  return {
    blob,
    objectUrl: URL.createObjectURL(blob),
    kind,
    inlinePlayable: canPlayInline(blob.size),
  };
}
