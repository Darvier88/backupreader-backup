import { encryptFile, FileTooLargeError } from "./fileCipher";
import { buildManifest, packPiece, packManifest, normalizeName } from "./manifest";
import { MAX_ENCRYPT_BYTES, CHUNK_SIZE } from "./constants";
import { newId, pieceAad } from "./paths";
import { detectKind, mimeFor } from "./zipStream";
import { abrirBackup, leerTextoDelChat, type Descargar } from "./readBackup";
import type { BackupManifest, BackupSource, PieceMeta } from "./types";

/**
 * Migración de backups v1 (texto plano) a v2 (cifrado).
 *
 * Un backup v1 no es un zip: la Cloud Function `unzip` ya lo descomprimió, así
 * que en Storage hay una carpeta con el `_chat.txt` y la media sueltos. Por eso
 * esto no puede reutilizar `uploadBackup`, que parte de un zip. Todo lo demás
 * —cifrar, empaquetar, construir el manifiesto— sí se reutiliza.
 *
 * El QUÉ se cifra está separado del DÓNDE, igual que en la subida: `descargar`,
 * `subirPieza` y `subirManifiesto` los inyecta quien llama, así que este módulo
 * no depende de Firebase y se puede probar contra un almacén falso.
 */

/** Un archivo de un backup v1, tal como está en Storage. */
export interface ArchivoV1 {
  /** Ruta completa en Storage, para descargarlo. */
  ruta: string;
  /** Nombre relativo a la carpeta del backup: lo que verá el manifiesto. */
  nombre: string;
  /**
   * Tamaño en bytes, si se conoce.
   *
   * Opcional a propósito: `list()` de Storage devuelve referencias sin
   * metadatos, y pedir el tamaño de cada archivo sería una petición extra por
   * pieza —miles en un backup grande— para un dato que solo sirve para saltarse
   * los archivos enormes. Cuando no viene, el tamaño se comprueba después de
   * descargar, que es donde `encryptFile` ya tiene su propio tope.
   */
  size?: number;
}

export interface OpcionesMigracion {
  /** Id del backup NUEVO. Entra en el AAD de cada pieza, así que es obligatorio. */
  backupId: string;
  source: BackupSource;
  subirPieza: (id: string, blob: Blob) => Promise<void>;
  subirManifiesto: (blob: Blob) => Promise<void>;
  /** Progreso en piezas, no en bytes. */
  onProgreso?: (hechas: number, total: number) => void;
  onOmitida?: (nombre: string, motivo: string) => void;
}

export interface ResultadoMigracion {
  manifest: BackupManifest;
  omitidas: Array<{ nombre: string; motivo: string }>;
}

/**
 * El nombre con el que el TEXTO DEL CHAT se refiere a este archivo, cuando no
 * coincide con el nombre real en Storage.
 *
 * Este es el detalle que hace que migrar no sea copiar. WhatsApp exporta las
 * notas de voz como `.opus`, y el `_chat.txt` las nombra así. Pero la Cloud
 * Function `unzip` las convertía a `.mp3` al descomprimir y guardaba el `.mp3`,
 * sin tocar el texto. En v1 eso se parcheaba al vuelo en `getMediaUrl`,
 * reescribiendo la extensión antes de pedir la URL.
 *
 * Al migrar hay que dejarlo resuelto en el manifiesto: la pieza se llama
 * `AUDIO-123.mp3` (que es lo que es) y además responde al nombre
 * `AUDIO-123.opus` (que es como la busca el chat). Sin esto, todas las notas de
 * voz de un backup migrado desaparecen sin dar ningún error.
 *
 * Solo aplica a WhatsApp: la conversión nunca tocó los exports de Instagram.
 */
export function aliasDelChat(nombre: string, source: BackupSource): string | undefined {
  if (source !== "whatsapp") return undefined;
  if (!/\.mp3$/i.test(nombre)) return undefined;
  return nombre.replace(/\.mp3$/i, ".opus");
}

const GENERICO = "application/octet-stream";

/**
 * Devuelve el blob con el mime que le corresponde por su nombre.
 *
 * `encryptFile` guarda `blob.type` en el manifiesto, y ese es el tipo con el
 * que después se construye el object URL. Si llega vacío o genérico, el <img>
 * o el <video> no pintan nada: el archivo está bien cifrado y bien guardado, y
 * aun así la conversación se ve rota.
 *
 * El blob que devuelve `getBlob()` trae el content-type que tenga el objeto en
 * Storage, que en los backups v1 lo puso la Cloud Function y no siempre es
 * correcto. El nombre del archivo es mejor fuente, así que manda salvo que no
 * sepamos deducir nada de él.
 *
 * `slice` y no `new Blob([blob])`: slice solo cambia la etiqueta, sin copiar
 * los bytes, que en un vídeo de 200 MB no es un detalle.
 */
function conMimeDelNombre(blob: Blob, nombre: string): Blob {
  const porNombre = mimeFor(nombre);
  if (porNombre === GENERICO) return blob.type ? blob : blob.slice(0, blob.size, GENERICO);
  if (blob.type === porNombre) return blob;
  return blob.slice(0, blob.size, porNombre);
}

/**
 * Cifra y sube un backup v1 completo.
 *
 * Igual que en la subida normal: primero todas las piezas, después el
 * manifiesto, y el documento de Firestore lo escribe quien llama AL FINAL. Si
 * esto se corta a la mitad, el backup nuevo no aparece en la lista, el v1 sigue
 * intacto, y lo que queda en Storage son blobs huérfanos.
 *
 * NO borra nada. El borrado del original va aparte y solo después de verificar.
 */
export async function migrarBackupV1(
  archivos: ArchivoV1[],
  dek: Uint8Array,
  nombre: string,
  descargar: Descargar,
  opts: OpcionesMigracion
): Promise<ResultadoMigracion> {
  const piezas: PieceMeta[] = [];
  const omitidas: Array<{ nombre: string; motivo: string }> = [];

  const anotar = (n: string, motivo: string) => {
    omitidas.push({ nombre: n, motivo });
    opts.onOmitida?.(n, motivo);
  };

  const total = archivos.length;
  let hechas = 0;

  for (const archivo of archivos) {
    /* Si el tamaño se conoce de antemano, se descarta antes de gastar la
       descarga. Si no, `encryptFile` lo rechazará con FileTooLargeError y se
       anota igual, unos megabytes más tarde. */
    if (archivo.size != null && archivo.size > MAX_ENCRYPT_BYTES) {
      anotar(archivo.nombre, "demasiado grande");
      opts.onProgreso?.(++hechas, total);
      continue;
    }

    const id = newId();
    try {
      /* Una pieza a la vez, y se suelta antes de la siguiente. Un backup v1
         puede ocupar cientos de MB; acumularlos dejaría la pestaña sin memoria
         justo en el móvil, que es donde más duele. */
      let blob: Blob | null = await descargar(archivo.ruta);
      blob = conMimeDelNombre(blob, archivo.nombre);

      const cifrada = await encryptFile(blob, dek, {
        aad: pieceAad(opts.backupId, id),
        blockSize: CHUNK_SIZE,
      });
      await opts.subirPieza(id, packPiece(cifrada));
      blob = null;

      piezas.push({
        id,
        name: archivo.nombre,
        alt: aliasDelChat(archivo.nombre, opts.source),
        kind: detectKind(archivo.nombre),
        mime: cifrada.mimeType,
        size: cifrada.size,
        cipherSize: cifrada.cipherSize,
      });
    } catch (err) {
      /* Una pieza rota no debe tumbar la migración entera: se anota y se sigue.
         El backup v1 no se borra si hay omitidas, así que nada se pierde. */
      anotar(
        archivo.nombre,
        err instanceof FileTooLargeError
          ? "demasiado grande"
          : err instanceof Error
          ? err.message
          : String(err)
      );
    }

    opts.onProgreso?.(++hechas, total);
  }

  const manifest = buildManifest({
    backupId: opts.backupId,
    name: nombre,
    source: opts.source,
    pieces: piezas,
  });

  await opts.subirManifiesto(await packManifest(manifest, dek));

  return { manifest, omitidas };
}

export class VerificacionFallida extends Error {
  constructor(motivo: string) {
    super(`La copia cifrada no se pudo verificar: ${motivo}`);
    this.name = "VerificacionFallida";
  }
}

/**
 * Comprueba que el backup recién escrito se puede volver a leer DE CERO.
 *
 * Esto es lo que autoriza a borrar el original, así que no se fía de nada que
 * haya quedado en memoria: descarga el manifiesto otra vez, lo descifra, y
 * descifra además la pieza del chat. Si el manifiesto se subió corrupto, si una
 * pieza no llegó, o si el AAD no cuadra, esto lanza y el v1 se queda donde
 * está.
 *
 * Verificar todas las piezas sería lo ideal, pero significa descargar y
 * descifrar el backup entero por segunda vez. El manifiesto más el chat detecta
 * los fallos que de verdad ocurren —subida cortada, clave equivocada, pieza que
 * no llegó al contarlas— a un coste asumible.
 */
export async function verificarMigracion(
  uid: string,
  backupId: string,
  dek: Uint8Array,
  descargar: Descargar,
  piezasEsperadas: number
): Promise<void> {
  let abierto;
  try {
    abierto = await abrirBackup(uid, backupId, dek, descargar);
  } catch (err) {
    throw new VerificacionFallida(
      `no se pudo abrir el manifiesto (${err instanceof Error ? err.message : String(err)})`
    );
  }

  if (abierto.manifest.pieces.length !== piezasEsperadas) {
    throw new VerificacionFallida(
      `el manifiesto tiene ${abierto.manifest.pieces.length} piezas y se esperaban ${piezasEsperadas}`
    );
  }

  let chat;
  try {
    chat = await leerTextoDelChat(uid, abierto, dek, descargar);
  } catch (err) {
    throw new VerificacionFallida(
      `no se pudo descifrar el texto del chat (${err instanceof Error ? err.message : String(err)})`
    );
  }

  if (!chat || !chat.texto.trim()) {
    throw new VerificacionFallida("el texto del chat quedó vacío");
  }
}

/**
 * Nombre legible del backup a partir de la carpeta v1.
 *
 * Las carpetas v1 se llaman como el zip original ("WhatsApp Chat - María"), a
 * veces con la barra final que devuelve Storage al listar prefijos.
 */
export function nombreDesdeCarpeta(prefijo: string): string {
  return (
    prefijo
      .replace(/\/+$/, "")
      .split("/")
      .pop() || prefijo
  );
}

/** Deduce el origen mirando dónde cuelga la carpeta v1. */
export function origenDeRuta(ruta: string): BackupSource {
  if (ruta.includes("/instagram/")) return "instagram";
  if (ruta.includes("/whatsapp/")) return "whatsapp";
  return "other";
}

/**
 * Comprueba que el backup v1 trae texto de chat antes de empezar.
 *
 * Una carpeta sin `.txt` ni `.json` no es un backup legible: migrarla gastaría
 * ancho de banda para producir algo que la app no sabe abrir.
 */
export function tieneTextoDeChat(archivos: ArchivoV1[]): boolean {
  return archivos.some((a) => {
    const n = normalizeName(a.nombre);
    return n.endsWith(".txt") || n.endsWith(".json");
  });
}
