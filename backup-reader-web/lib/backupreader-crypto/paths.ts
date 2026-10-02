/**
 * Rutas de Storage y Firestore (Etapa 2).
 *
 * Todo en un solo archivo para que las reglas de Firebase y el código de la app
 * no se desincronicen: si cambia una ruta, cambia aquí y se revisa storage.rules.
 *
 * Regla de oro: por debajo de `{uid}` no aparece NINGÚN nombre real. El prefijo
 * del uid se mantiene porque es lo que usan las reglas para decidir el dueño.
 *
 *   backups/{uid}/{backupId}/manifest     ← JSON del manifiesto, cifrado
 *   backups/{uid}/{backupId}/p/{pieceId}  ← una pieza cifrada, sin extensión
 */

/** Content-type con el que se suben TODOS los blobs cifrados. */
export const BLOB_CONTENT_TYPE = "application/octet-stream";

/**
 * No es cosmético: la Cloud Function `unzip` filtra por "application/zip", así
 * que subir con octet-stream ya la desactiva para las subidas nuevas sin tener
 * que tocar ni desplegar la función.
 */

export const BLOB_CACHE_CONTROL = "private, max-age=0, no-store";

// --- Storage ---

export const backupPrefix = (uid: string, backupId: string) =>
  `backups/${uid}/${backupId}`;

export const manifestPath = (uid: string, backupId: string) =>
  `${backupPrefix(uid, backupId)}/manifest`;

export const piecePath = (uid: string, backupId: string, pieceId: string) =>
  `${backupPrefix(uid, backupId)}/p/${pieceId}`;

// --- Firestore ---

export const vaultDocPath = (uid: string) => `vaults/${uid}`;

export const backupDocPath = (uid: string, backupId: string) =>
  `vaults/${uid}/backups/${backupId}`;

export const backupsCollectionPath = (uid: string) => `vaults/${uid}/backups`;

// --- AAD (datos asociados autenticados) ---

/**
 * Cada pieza se cifra atada a su propia ruta lógica. Si el servidor intercambia
 * el blob de una pieza por el de otra (aunque sea del mismo usuario), el AAD no
 * coincide y el descifrado falla en vez de entregar el archivo equivocado.
 */
export const pieceAad = (backupId: string, pieceId: string) =>
  `br1:${backupId}:${pieceId}`;

export const manifestAad = (backupId: string) => `br1:${backupId}:manifest`;

/** Genera un id opaco. `crypto.randomUUID` existe en todos los navegadores objetivo. */
export function newId(): string {
  const c = globalThis.crypto;
  if (typeof c?.randomUUID === "function") return c.randomUUID();
  // Respaldo por si el contexto no es seguro (no debería pasar en producción:
  // randomUUID exige HTTPS o localhost).
  const b = new Uint8Array(16);
  c.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}
