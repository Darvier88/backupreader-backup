import { getSodium } from "./sodium";
import { CHUNK_SIZE, MAX_ENCRYPT_BYTES, BLOB_FLUSH_BYTES } from "./constants";
import type { EncryptedFile } from "./types";

/**
 * Cifrado de archivos con XChaCha20-Poly1305 (crypto_secretstream) en bloques
 * de 64 KiB, con marca de bloque final contra truncamiento.
 *
 * Lectura en streaming: nunca carga el archivo de origen entero en memoria.
 * La SALIDA también se va empacando en sub-Blobs cada BLOB_FLUSH_BYTES, para
 * que el navegador pueda respaldarla en disco en vez de acumularla en el heap.
 */

// Lee un Blob en bloques de blockSize usando su ReadableStream (ruta rápida).
async function* readBlocks(blob: Blob, blockSize: number): AsyncGenerator<Uint8Array> {
  const reader = blob.stream().getReader();
  let buf = new Uint8Array(blockSize);
  let fill = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    let p = 0;
    while (p < value.length) {
      const n = Math.min(blockSize - fill, value.length - p);
      buf.set(value.subarray(p, p + n), fill);
      fill += n;
      p += n;
      if (fill === blockSize) {
        yield buf;
        buf = new Uint8Array(blockSize);
        fill = 0;
      }
    }
  }
  if (fill > 0) yield buf.subarray(0, fill);
}

/**
 * Acumulador que convierte una secuencia de Uint8Array en un Blob sin mantener
 * todo en el heap: cada BLOB_FLUSH_BYTES empaca lo pendiente en un sub-Blob.
 */
class BlobBuilder {
  private parts: Blob[] = [];
  private pending: Uint8Array[] = [];
  private pendingBytes = 0;

  push(chunk: Uint8Array) {
    this.pending.push(chunk);
    this.pendingBytes += chunk.length;
    if (this.pendingBytes >= BLOB_FLUSH_BYTES) this.flush();
  }

  private flush() {
    if (!this.pending.length) return;
    this.parts.push(new Blob(this.pending as BlobPart[]));
    this.pending = [];
    this.pendingBytes = 0;
  }

  finish(type?: string): Blob {
    this.flush();
    const blob = type ? new Blob(this.parts, { type }) : new Blob(this.parts);
    this.parts = [];
    return blob;
  }
}

export class FileTooLargeError extends Error {
  constructor(public size: number) {
    super(`Archivo demasiado grande para cifrar: ${size} bytes (máx ${MAX_ENCRYPT_BYTES}).`);
    this.name = "FileTooLargeError";
  }
}

export interface CipherOptions {
  /**
   * Datos asociados (AAD). No se cifran, pero quedan autenticados: si al
   * descifrar no se pasa exactamente el mismo valor, el descifrado falla.
   *
   * La app pasa aquí el id de la pieza. Así el servidor no puede intercambiar
   * el blob de una pieza por el de otra del mismo usuario sin que se note.
   */
  aad?: string;
  /** Tamaño de bloque. Solo cambiar junto con FORMAT_VERSION. */
  blockSize?: number;
}

/** Cifra un Blob/File con la DEK. Devuelve la cabecera + el ciphertext (para subir). */
export async function encryptFile(
  plain: Blob,
  dek: Uint8Array,
  opts: CipherOptions = {}
): Promise<EncryptedFile> {
  if (plain.size > MAX_ENCRYPT_BYTES) throw new FileTooLargeError(plain.size);
  const s = await getSodium();
  const blockSize = opts.blockSize ?? CHUNK_SIZE;
  const ad = opts.aad ? s.from_string(opts.aad) : null;

  const { state, header } = s.crypto_secretstream_xchacha20poly1305_init_push(dek);
  const TAG_MSG = s.crypto_secretstream_xchacha20poly1305_TAG_MESSAGE;
  const TAG_FIN = s.crypto_secretstream_xchacha20poly1305_TAG_FINAL;

  const out = new BlobBuilder();

  // Un archivo vacío no produce ningún bloque, así que nunca se emitiría el
  // tag FINAL y el descifrado fallaría después con "falta la marca final".
  // Los exports de WhatsApp sí traen entradas de 0 bytes de vez en cuando.
  if (plain.size === 0) {
    out.push(
      s.crypto_secretstream_xchacha20poly1305_push(state, new Uint8Array(0), ad, TAG_FIN)
    );
  } else {
    let off = 0;
    for await (const block of readBlocks(plain, blockSize)) {
      const isLast = off + block.length >= plain.size;
      out.push(
        s.crypto_secretstream_xchacha20poly1305_push(state, block, ad, isLast ? TAG_FIN : TAG_MSG)
      );
      off += block.length;
    }
  }

  const ciphertext = out.finish();
  return {
    header,
    ciphertext,
    size: plain.size,
    cipherSize: ciphertext.size,
    mimeType: plain.type || "application/octet-stream",
  };
}

/**
 * Descifra un archivo cifrado. Devuelve un Blob con el contenido original.
 * `header` es la cabecera devuelta por encryptFile; `ciphertext` los bloques.
 * Verifica la marca de bloque final (detecta truncamiento/manipulación).
 *
 * `blockSize` debe ser el mismo con el que se cifró: sale del manifiesto, no
 * se asume. Si no coincide, el descifrado falla en el primer bloque.
 */
export async function decryptFile(
  header: Uint8Array,
  ciphertext: Blob,
  dek: Uint8Array,
  mimeType = "application/octet-stream",
  opts: CipherOptions = {}
): Promise<Blob> {
  const s = await getSodium();
  const blockSize = opts.blockSize ?? CHUNK_SIZE;
  const ad = opts.aad ? s.from_string(opts.aad) : null;

  const CIPHER_CHUNK = blockSize + s.crypto_secretstream_xchacha20poly1305_ABYTES;
  const state = s.crypto_secretstream_xchacha20poly1305_init_pull(header, dek);
  const TAG_FIN = s.crypto_secretstream_xchacha20poly1305_TAG_FINAL;

  const out = new BlobBuilder();
  let off = 0;
  let sawFinal = false;

  while (off < ciphertext.size) {
    const end = Math.min(off + CIPHER_CHUNK, ciphertext.size);
    const cbuf = new Uint8Array(await ciphertext.slice(off, end).arrayBuffer());
    const res = s.crypto_secretstream_xchacha20poly1305_pull(state, cbuf, ad);
    if (!res) throw new Error("Bloque inválido al descifrar (manipulación o truncamiento).");
    out.push(res.message);
    if (res.tag === TAG_FIN) sawFinal = true;
    off = end;
  }

  if (!sawFinal) throw new Error("Falta la marca de bloque final: el archivo puede estar truncado.");
  return out.finish(mimeType);
}

// --- Texto corto (mensajes, metadatos): un solo paso con secretbox ---

export async function encryptText(text: string, dek: Uint8Array): Promise<{ n: Uint8Array; c: Uint8Array }> {
  const s = await getSodium();
  const nonce = s.randombytes_buf(s.crypto_secretbox_NONCEBYTES);
  return { n: nonce, c: s.crypto_secretbox_easy(s.from_string(text), nonce, dek) };
}

export async function decryptText(nonce: Uint8Array, ciphertext: Uint8Array, dek: Uint8Array): Promise<string> {
  const s = await getSodium();
  return s.to_string(s.crypto_secretbox_open_easy(ciphertext, nonce, dek));
}
