/**
 * Núcleo criptográfico de Backup Reader (E2EE en navegador).
 *
 * Esquema: envelope encryption (Argon2id → KEK → envuelve una DEK aleatoria).
 * Archivos: XChaCha20-Poly1305 (secretstream) por bloques de 64 KiB.
 * Zip: descompresión en streaming, cifrando cada pieza por separado.
 */

export * from "./types";
export {
  KDF,
  KDF_LIMITS,
  CHUNK_SIZE,
  HEADER_BYTES,
  MAX_ENCRYPT_BYTES,
  INLINE_PLAYBACK_MAX_BYTES,
  VAULT_VERSION,
  FORMAT_VERSION,
} from "./constants";

// Claves / cuenta
export {
  createVault,
  unlockWithPassword,
  unlockWithRecovery,
  changePassword,
  resetRecoveryCode,
  generateRecoveryCode,
  normalizeRecovery,
  lockVault,
} from "./vault";

// Cifrado de archivos y texto
export {
  encryptFile,
  decryptFile,
  encryptText,
  decryptText,
  FileTooLargeError,
} from "./fileCipher";
export type { CipherOptions } from "./fileCipher";

// Zip en streaming
export { openZip, iterateZip, detectKind, mimeFor } from "./zipStream";
export type { ZipEntry, OpenZip } from "./zipStream";

// Orquestador de backup completo
export { processBackupZip } from "./processBackup";
export type { ProcessOptions } from "./processBackup";

// Subida cifrada (Etapa 5)
export { uploadBackup, detectarOrigen } from "./uploadBackup";
export type { SubidaOpciones, SubidaResultado } from "./uploadBackup";

// Modelo de datos: rutas, manifiesto, empaquetado
export {
  BLOB_CONTENT_TYPE,
  BLOB_CACHE_CONTROL,
  backupPrefix,
  manifestPath,
  piecePath,
  vaultDocPath,
  backupDocPath,
  backupsCollectionPath,
  pieceAad,
  manifestAad,
  newId,
} from "./paths";

export {
  packPiece,
  unpackPiece,
  openPiece,
  packManifest,
  openManifest,
  buildManifest,
  normalizeName,
  indexByName,
  findChatPiece,
  cipherBytes,
} from "./manifest";

// Lectura de backups cifrados (Etapa 6)
export {
  abrirBackup,
  leerPieza,
  leerTextoDelChat,
  resolverMedia,
  HANDLE_V2,
  handleDeBackup,
  esHandleV2,
  backupIdDeHandle,
} from "./readBackup";
export type { BackupAbierto, Descargar, ResultadoMedia } from "./readBackup";

// Migración de backups v1 en texto plano (Etapa 8)
export {
  migrarBackupV1,
  verificarMigracion,
  VerificacionFallida,
  aliasDelChat,
  nombreDesdeCarpeta,
  origenDeRuta,
  tieneTextoDeChat,
} from "./migrateBackup";
export type {
  ArchivoV1,
  OpcionesMigracion,
  ResultadoMigracion,
} from "./migrateBackup";

// Reproducción según política de tamaños
export { canPlayInline, decryptForPlayback } from "./playback";
export type { DecryptedMedia } from "./playback";

// Pruebas
export { runSelfTest } from "./selftest";
export type { SelfTestResult } from "./selftest";
