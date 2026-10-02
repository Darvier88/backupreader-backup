import { openZip, detectKind } from "./zipStream";
import { encryptFile, FileTooLargeError } from "./fileCipher";
import { MAX_ENCRYPT_BYTES, CHUNK_SIZE } from "./constants";
import { newId, pieceAad } from "./paths";
import type { BackupEntryResult, OnEncrypted, PieceMeta } from "./types";

export interface ProcessOptions {
  /** Id del backup: entra en el AAD de cada pieza, así que es obligatorio. */
  backupId: string;
  /** Se llama por cada pieza cifrada; aquí la app la sube (p. ej. a Firebase Storage). */
  onEncrypted: OnEncrypted;
  /** Progreso opcional (0..1) tras cada pieza. */
  onProgress?: (done: number, total: number) => void;
  /** Se llena con los metadatos de cada pieza cifrada, para armar el manifiesto. */
  pieces?: PieceMeta[];
}

/**
 * Procesa un zip exportado de WhatsApp:
 *   1. Lo descomprime en streaming (una pieza a la vez).
 *   2. Cifra cada pieza por separado con la DEK, atada a su id (AAD).
 *   3. Entrega cada pieza cifrada por `onEncrypted` (la app la sube).
 *
 * Política de tamaños:
 *   - Se cifra hasta MAX_ENCRYPT_BYTES (1 GiB) por archivo.
 *   - Por encima, la pieza se marca "skipped-too-large" (no se cifra) y se
 *     continúa con el resto, para no romper todo el backup por un archivo.
 *
 * Es un generador async: hace `yield` de un resultado por pieza, para que la UI
 * muestre el progreso en vivo. Si `opts.pieces` viene dado, ahí quedan los
 * metadatos listos para `buildManifest`.
 */
export async function* processBackupZip(
  zipFile: Blob,
  dek: Uint8Array,
  opts: ProcessOptions
): AsyncGenerator<BackupEntryResult> {
  // El zip se abre UNA vez: antes se abría dos veces, una solo para contar.
  const zip = await openZip(zipFile);
  const total = zip.entries.length;
  let done = 0;

  try {
    for (const entry of zip.entries) {
      const kind = detectKind(entry.name);
      const t0 = performance.now();

      if (entry.size > MAX_ENCRYPT_BYTES) {
        done++;
        opts.onProgress?.(done, total);
        yield {
          id: "",
          name: entry.name,
          kind,
          size: entry.size,
          cipherSize: 0,
          status: "skipped-too-large",
          durationMs: performance.now() - t0,
        };
        continue;
      }

      const id = newId();
      try {
        let blob: Blob | null = await entry.getBlob();
        const encrypted = await encryptFile(blob, dek, {
          aad: pieceAad(opts.backupId, id),
          blockSize: CHUNK_SIZE,
        });
        await opts.onEncrypted({ id, name: entry.name, kind, encrypted });
        blob = null; // liberar la pieza antes de la siguiente

        opts.pieces?.push({
          id,
          name: entry.name,
          kind,
          mime: encrypted.mimeType,
          size: encrypted.size,
          cipherSize: encrypted.cipherSize,
        });

        done++;
        opts.onProgress?.(done, total);
        yield {
          id,
          name: entry.name,
          kind,
          size: encrypted.size,
          cipherSize: encrypted.cipherSize,
          status: "encrypted",
          durationMs: performance.now() - t0,
        };
      } catch (err) {
        done++;
        opts.onProgress?.(done, total);
        yield {
          id: "",
          name: entry.name,
          kind,
          size: entry.size,
          cipherSize: 0,
          status: err instanceof FileTooLargeError ? "skipped-too-large" : "error",
          durationMs: performance.now() - t0,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }
  } finally {
    await zip.close();
  }
}
