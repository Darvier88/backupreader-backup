import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
} from "firebase/firestore";

import { FirebaseDB } from "./firebase";
import {
  backupDocPath,
  backupsCollectionPath,
  type BackupDoc,
} from "../lib/backupreader-crypto";

/**
 * Metadatos de los backups cifrados, en `vaults/{uid}/backups/{backupId}`.
 *
 * Deliberadamente SIN el nombre del chat: ese dato vive dentro del manifiesto
 * cifrado, en Storage. Aquí solo va lo que el servidor necesita para listar y
 * para las cuotas.
 */

/**
 * Registra el backup. Se llama AL FINAL, cuando todas las piezas y el
 * manifiesto ya están subidos: si la subida se corta antes, el backup no
 * aparece en la lista y lo que queda en Storage son blobs huérfanos.
 */
export async function registrarBackup(
  uid: string,
  backupId: string,
  datos: { pieceCount: number; cipherBytes: number; fmt: number }
): Promise<void> {
  const documento: BackupDoc = {
    createdAt: Date.now(),
    pieceCount: datos.pieceCount,
    cipherBytes: datos.cipherBytes,
    encVersion: 2,
    fmt: datos.fmt,
  };
  await setDoc(doc(FirebaseDB, backupDocPath(uid, backupId)), documento);
}

/** Lista los backups cifrados del usuario, del más reciente al más antiguo. */
export async function listarBackups(
  uid: string
): Promise<Array<BackupDoc & { backupId: string }>> {
  const snap = await getDocs(collection(FirebaseDB, backupsCollectionPath(uid)));
  return snap.docs
    .map((d) => ({ ...(d.data() as BackupDoc), backupId: d.id }))
    .sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Deja constancia de que este backup ya tiene índice de búsqueda.
 *
 * Es TODO el estado de reanudación que hace falta. No hay un contador de "iba
 * por el chat 7": lo pendiente se deduce de qué documentos no tienen esta
 * marca. Eso sobrevive a cerrar la pestaña y a cambiar de dispositivo sin
 * escribir nada extra, no se puede desincronizar, y un chat nuevo entra solo
 * en la lista de pendientes.
 *
 * Va la VERSIÓN y no un booleano: cuando el formato del índice cambie, los
 * índices viejos quedan marcados con la versión antigua y se reconstruyen
 * solos, sin tener que salir a limpiar marcas a mano.
 *
 * `merge: true` porque esto añade un campo a un documento que ya existe. Las
 * reglas validan el documento resultante completo, así que los campos que ya
 * estaban siguen ahí y la validación pasa.
 */
export async function marcarIndexado(
  uid: string,
  backupId: string,
  version: number
): Promise<void> {
  await setDoc(
    doc(FirebaseDB, backupDocPath(uid, backupId)),
    { idxVersion: version },
    { merge: true }
  );
}

/** Borra el registro. Las piezas de Storage se borran aparte. */
export async function borrarRegistroBackup(
  uid: string,
  backupId: string
): Promise<void> {
  await deleteDoc(doc(FirebaseDB, backupDocPath(uid, backupId)));
}

/** Bytes cifrados totales, para la cuota de plan. */
export async function bytesOcupados(uid: string): Promise<number> {
  const backups = await listarBackups(uid);
  return backups.reduce((a, b) => a + b.cipherBytes, 0);
}
