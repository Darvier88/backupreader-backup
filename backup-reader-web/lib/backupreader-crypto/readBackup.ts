import { openManifest, openPiece, indexByName, findChatPiece, normalizeName } from "./manifest";
import { manifestPath, piecePath, pieceAad } from "./paths";
import { canPlayInline } from "./playback";
import type { BackupManifest, PieceMeta } from "./types";

/**
 * Lectura de backups cifrados (Etapa 6).
 *
 * Igual que en la subida, el QUÉ se descifra está separado del DÓNDE se
 * descarga: `descargar` lo inyecta quien llama (en la app, `getBlob` de
 * Firebase). Así el módulo no depende de Firebase y se puede probar contra un
 * almacén falso.
 *
 * Nota sobre `getBlob` frente a `getDownloadURL`: el download URL lleva un
 * token que funciona para cualquiera que lo tenga, saltándose las reglas.
 * `getBlob` va con el token de sesión, así que las reglas sí se aplican.
 */

/** Descarga un objeto de Storage por su ruta. */
export type Descargar = (ruta: string) => Promise<Blob>;

/**
 * Un backup abierto: el manifiesto descifrado más el índice por nombre.
 *
 * El índice es lo que sustituye al antiguo `getAsset(ruta + '/' + nombre)`:
 * traduce el nombre que aparece en el texto del chat a la pieza opaca que hay
 * que descargar.
 */
export interface BackupAbierto {
  backupId: string;
  manifest: BackupManifest;
  porNombre: Map<string, PieceMeta>;
}

/** Descarga y descifra el manifiesto de un backup. */
export async function abrirBackup(
  uid: string,
  backupId: string,
  dek: Uint8Array,
  descargar: Descargar
): Promise<BackupAbierto> {
  const blob = await descargar(manifestPath(uid, backupId));
  const manifest = await openManifest(blob, dek, backupId);
  return { backupId, manifest, porNombre: indexByName(manifest) };
}

/** Descarga y descifra una pieza concreta. */
export async function leerPieza(
  uid: string,
  backupId: string,
  pieza: PieceMeta,
  dek: Uint8Array,
  descargar: Descargar,
  blockSize?: number
): Promise<Blob> {
  const blob = await descargar(piecePath(uid, backupId, pieza.id));
  return openPiece(blob, dek, {
    mime: pieza.mime,
    aad: pieceAad(backupId, pieza.id),
    blockSize,
  });
}

/**
 * Devuelve el texto del chat (el `_chat.txt`, o el JSON de Instagram).
 *
 * Es lo primero que se pide al abrir una conversación: sin esto no hay nada
 * que pintar.
 */
export async function leerTextoDelChat(
  uid: string,
  abierto: BackupAbierto,
  dek: Uint8Array,
  descargar: Descargar
): Promise<{ texto: string; nombre: string } | null> {
  const pieza = findChatPiece(abierto.manifest);
  if (!pieza) return null;
  const blob = await leerPieza(
    uid,
    abierto.backupId,
    pieza,
    dek,
    descargar,
    abierto.manifest.blockSize
  );
  return { texto: await blob.text(), nombre: pieza.name };
}

export interface OpcionesMedia {
  /**
   * Transformación opcional del blob descifrado antes de crear el object URL.
   *
   * La usa la app para el respaldo de Opus (Etapa 7): en los navegadores que
   * no saben reproducir Ogg Opus, el audio se convierte a WAV aquí, antes de
   * llegar al <audio>. Se inyecta en vez de importarse para que este módulo no
   * dependa del decodificador.
   */
  transformar?: (blob: Blob, pieza: PieceMeta) => Promise<Blob>;
}

export type ResultadoMedia =
  | { estado: "ok"; objectUrl: string; pieza: PieceMeta }
  | { estado: "demasiado-grande"; pieza: PieceMeta }
  | { estado: "no-encontrada" };

/**
 * Resuelve un archivo mencionado en el chat y devuelve un object URL listo
 * para un <img>, <audio> o <video>.
 *
 * IMPORTANTE: quien llama debe revocar el objectUrl con URL.revokeObjectURL
 * cuando deje de usarlo. En un chat largo con carga perezosa, no revocarlos es
 * una fuga de memoria directa: cada foto descifrada se queda en RAM.
 *
 * Por encima de INLINE_PLAYBACK_MAX_BYTES (300 MiB) no se descifra: meter un
 * archivo así en un <video> congela la pantalla en móvil. Se devuelve
 * "demasiado-grande" para que la interfaz ofrezca descargarlo.
 */
export async function resolverMedia(
  uid: string,
  abierto: BackupAbierto,
  nombreArchivo: string,
  dek: Uint8Array,
  descargar: Descargar,
  opts: OpcionesMedia = {}
): Promise<ResultadoMedia> {
  const pieza = abierto.porNombre.get(normalizeName(nombreArchivo));
  if (!pieza) return { estado: "no-encontrada" };
  if (!canPlayInline(pieza.size)) return { estado: "demasiado-grande", pieza };

  let blob = await leerPieza(
    uid,
    abierto.backupId,
    pieza,
    dek,
    descargar,
    abierto.manifest.blockSize
  );

  if (opts.transformar) blob = await opts.transformar(blob, pieza);

  return { estado: "ok", objectUrl: URL.createObjectURL(blob), pieza };
}

// ---------------------------------------------------------------------------
// Identificador de backup (convivencia v1 / v2)
// ---------------------------------------------------------------------------

/**
 * La interfaz identifica cada backup con una cadena opaca.
 *
 *  - v1 (texto plano): la ruta de Storage de siempre.
 *  - v2 (cifrado):     "v2:{backupId}".
 *
 * Mantener una sola cadena en vez de dos campos deja el drawer, el dashboard y
 * los cajones móviles sin tocar: toda la bifurcación v1/v2 vive dentro de
 * StorageContext. Cuando no queden backups v1, esto se puede simplificar.
 */
export const HANDLE_V2 = "v2:";

export const handleDeBackup = (backupId: string) => `${HANDLE_V2}${backupId}`;

export const esHandleV2 = (handle: string) =>
  typeof handle === "string" && handle.startsWith(HANDLE_V2);

export const backupIdDeHandle = (handle: string) =>
  esHandleV2(handle) ? handle.slice(HANDLE_V2.length) : null;
