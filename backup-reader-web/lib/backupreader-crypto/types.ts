/** Tipos compartidos del núcleo criptográfico. */

/** Un valor cifrado con una clave (nonce + ciphertext, ambos en base64). */
export interface WrappedKey {
  n: string; // nonce (base64)
  c: string; // ciphertext (base64)
}

/** Parámetros del KDF, guardados en el record para poder subirlos sin romper nada. */
export interface KdfParams {
  alg: "argon2id";
  memMiB: number;
  ops: number;
}

/**
 * Lo ÚNICO que se guarda en el servidor por cuenta.
 * No contiene la contraseña, ni el código de recuperación, ni la DEK,
 * ni ningún dato en texto plano: solo salts y envoltorios cifrados.
 */
export interface VaultRecord {
  version: 1;
  kdf: KdfParams;
  pwSalt: string; // base64
  recSalt: string; // base64
  wrapPassword: WrappedKey; // DEK envuelta por la contraseña
  wrapRecovery: WrappedKey; // DEK envuelta por el código de recuperación
}

/** Resultado del registro: qué guardar, el código a mostrar una vez, y la DEK en memoria. */
export interface CreatedVault {
  record: VaultRecord;
  recoveryCode: string; // mostrar UNA vez al usuario; nunca se guarda
  dek: Uint8Array; // clave de datos, solo en memoria
}

export type FileKind = "chat" | "image" | "audio" | "video" | "document";

export type BackupSource = "whatsapp" | "instagram" | "other";

/** Un archivo cifrado listo para subir: cabecera del stream + ciphertext. */
export interface EncryptedFile {
  header: Uint8Array; // cabecera de secretstream (24 bytes)
  ciphertext: Blob; // bloques cifrados
  size: number; // tamaño original en bytes
  cipherSize: number; // tamaño del ciphertext
  mimeType: string;
}

export type EntryStatus = "encrypted" | "skipped-too-large" | "error";

/** Resultado del procesamiento de UNA pieza del zip. */
export interface BackupEntryResult {
  id: string; // id opaco con el que se guardó (vacío si no se cifró)
  name: string;
  kind: FileKind;
  size: number;
  cipherSize: number;
  status: EntryStatus;
  durationMs: number;
  error?: string;
}

/** Callback que la app usa para subir cada pieza cifrada (p. ej. a Firebase Storage). */
export type OnEncrypted = (piece: {
  id: string; // nombre del blob en Storage (uuid, sin extensión)
  name: string; // nombre original dentro del zip (NO sale del navegador sin cifrar)
  kind: FileKind;
  encrypted: EncryptedFile;
}) => Promise<void> | void;

// ---------------------------------------------------------------------------
// Modelo de datos (Etapa 2)
// ---------------------------------------------------------------------------

/**
 * Una pieza dentro del manifiesto.
 *
 * `id` es lo único que ve el servidor. `name` es el nombre real del archivo
 * dentro del zip y vive SOLO aquí dentro, cifrado.
 */
export interface PieceMeta {
  id: string;
  name: string;
  /**
   * Otro nombre por el que el texto del chat puede pedir esta pieza.
   *
   * Existe por los backups migrados desde v1: la Cloud Function `unzip`
   * convertía las notas de voz de `.opus` a `.mp3` y guardaba el `.mp3`, pero
   * el `_chat.txt` las sigue nombrando `.opus`. La pieza se llama como lo que
   * de verdad es, y `alt` recoge el nombre por el que la busca el chat.
   *
   * En los backups subidos ya cifrados no se usa: ahí el nombre dentro del zip
   * y el del texto coinciden siempre.
   */
  alt?: string;
  kind: FileKind;
  mime: string;
  size: number; // bytes en claro
  cipherSize: number; // bytes cifrados (lo que ocupa en Storage)
}

/**
 * Manifiesto de un backup. Se guarda cifrado con la DEK en
 * `backups/{uid}/{backupId}/manifest`.
 *
 * Es lo que traduce "IMG-20240101-WA0003.jpg" al blob opaco que hay que
 * descargar. Sin él, con ids aleatorios la app no puede encontrar nada.
 */
export interface BackupManifest {
  fmt: number; // FORMAT_VERSION con el que se escribió
  blockSize: number; // tamaño de bloque usado al cifrar
  backupId: string;
  name: string; // nombre real del chat ("WhatsApp Chat - María Pérez")
  source: BackupSource;
  createdAt: number; // epoch ms
  pieces: PieceMeta[];
}

/**
 * Documento de Firestore en `vaults/{uid}/backups/{backupId}`.
 *
 * Deliberadamente SIN nombre: el nombre del chat es justamente el dato más
 * sensible y vive dentro del manifiesto cifrado. Aquí solo van metadatos que
 * el servidor necesita para cuotas y listados.
 */
export interface BackupDoc {
  createdAt: number;
  pieceCount: number;
  cipherBytes: number;
  encVersion: 2;
  fmt: number;
}
