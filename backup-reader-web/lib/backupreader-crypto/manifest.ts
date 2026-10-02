import { encryptFile, decryptFile } from "./fileCipher";
import { HEADER_BYTES, CHUNK_SIZE, FORMAT_VERSION } from "./constants";
import { manifestAad } from "./paths";
import type { BackupManifest, EncryptedFile, PieceMeta } from "./types";

/**
 * Empaquetado de piezas y manifiesto (Etapa 2).
 *
 * Cada objeto de Storage es UN blob: `header || ciphertext`. Así no hay que
 * guardar la cabecera en un campo aparte ni subir dos objetos por archivo.
 */

/** Une cabecera y ciphertext en el blob que se sube. */
export function packPiece(enc: EncryptedFile): Blob {
  return new Blob([enc.header as BlobPart, enc.ciphertext]);
}

/** Separa el blob descargado en cabecera y ciphertext. */
export function unpackPiece(blob: Blob): { header: Promise<Uint8Array>; ciphertext: Blob } {
  if (blob.size < HEADER_BYTES) {
    throw new Error(`Blob demasiado corto para contener una cabecera (${blob.size} bytes).`);
  }
  return {
    header: blob.slice(0, HEADER_BYTES).arrayBuffer().then((b) => new Uint8Array(b)),
    ciphertext: blob.slice(HEADER_BYTES),
  };
}

/** Descarga → descifra: la operación inversa de packPiece. */
export async function openPiece(
  blob: Blob,
  dek: Uint8Array,
  opts: { mime?: string; aad?: string; blockSize?: number } = {}
): Promise<Blob> {
  const { header, ciphertext } = unpackPiece(blob);
  return decryptFile(await header, ciphertext, dek, opts.mime, {
    aad: opts.aad,
    blockSize: opts.blockSize ?? CHUNK_SIZE,
  });
}

/** Cifra el manifiesto listo para subir. */
export async function packManifest(
  manifest: BackupManifest,
  dek: Uint8Array
): Promise<Blob> {
  const json = new Blob([JSON.stringify(manifest)], { type: "application/json" });
  const enc = await encryptFile(json, dek, { aad: manifestAad(manifest.backupId) });
  return packPiece(enc);
}

/** Descifra el manifiesto descargado. */
export async function openManifest(
  blob: Blob,
  dek: Uint8Array,
  backupId: string
): Promise<BackupManifest> {
  const plain = await openPiece(blob, dek, {
    mime: "application/json",
    aad: manifestAad(backupId),
  });
  const manifest = JSON.parse(await plain.text()) as BackupManifest;

  if (manifest.fmt > FORMAT_VERSION) {
    throw new Error(
      `Este backup usa el formato v${manifest.fmt} y esta versión de la app entiende hasta v${FORMAT_VERSION}. Actualiza la página.`
    );
  }
  return manifest;
}

/** Construye un manifiesto nuevo. */
export function buildManifest(args: {
  backupId: string;
  name: string;
  source: BackupManifest["source"];
  pieces: PieceMeta[];
  blockSize?: number;
}): BackupManifest {
  return {
    fmt: FORMAT_VERSION,
    blockSize: args.blockSize ?? CHUNK_SIZE,
    backupId: args.backupId,
    name: args.name,
    source: args.source,
    createdAt: Date.now(),
    pieces: args.pieces,
  };
}

// ---------------------------------------------------------------------------
// Índice por nombre: lo que reemplaza a `getAsset(ruta + '/' + nombre)`
// ---------------------------------------------------------------------------

/**
 * Normaliza un nombre de archivo para poder cruzarlo con lo que aparece en el
 * texto del chat.
 *
 * Tres cosas que hay que limpiar:
 *  - las entradas del zip traen la carpeta delante ("WhatsApp Chat - X/IMG.jpg")
 *    y en el texto del chat solo aparece el nombre suelto;
 *  - WhatsApp mete caracteres invisibles (U+200E y compañía) en las líneas;
 *  - iOS y Android exportan con mayúsculas distintas.
 */
export function normalizeName(name: string): string {
  return (name || "")
    .replace(/[\u200B-\u200D\uFEFF\u200E\u200F]/g, "")
    .split(/[\\/]/)
    .pop()!
    .trim()
    .toLowerCase();
}

/**
 * Índice nombre → pieza, para resolver la media al pintar los mensajes.
 *
 * Cada pieza se indexa por su nombre y, si lo tiene, por su `alt`. El `alt`
 * existe por los backups migrados desde v1, donde el archivo se llama
 * `AUDIO-123.mp3` pero el texto del chat lo pide como `AUDIO-123.opus`. Se
 * indexa en segundo lugar a propósito: ante un choque, el nombre real gana.
 */
export function indexByName(manifest: BackupManifest): Map<string, PieceMeta> {
  const map = new Map<string, PieceMeta>();
  for (const p of manifest.pieces) {
    const key = normalizeName(p.name);
    if (!map.has(key)) map.set(key, p); // ante duplicados, gana el primero
  }
  for (const p of manifest.pieces) {
    if (!p.alt) continue;
    const key = normalizeName(p.alt);
    if (!map.has(key)) map.set(key, p);
  }
  return map;
}

/** La pieza del chat (el `_chat.txt` o el JSON de Instagram). */
export function findChatPiece(manifest: BackupManifest): PieceMeta | undefined {
  return (
    manifest.pieces.find((p) => p.kind === "chat") ??
    manifest.pieces.find((p) => normalizeName(p.name).endsWith(".json"))
  );
}

/** Suma de bytes cifrados, para las cuotas de plan. */
export function cipherBytes(manifest: BackupManifest): number {
  return manifest.pieces.reduce((a, p) => a + p.cipherSize, 0);
}
