import { doc, getDoc, setDoc } from "firebase/firestore";

import { FirebaseDB } from "./firebase";
import { vaultDocPath, type VaultRecord } from "../lib/backupreader-crypto";

/**
 * Acceso a `vaults/{uid}` en Firestore.
 *
 * Ese documento contiene salts y los dos envoltorios cifrados de la DEK. Nunca
 * la contraseña, nunca el código de recuperación, nunca la DEK en claro: aunque
 * alguien lo lea entero, sin la contraseña no sirve de nada.
 */

/** Lee el record del usuario. Devuelve null si nunca creó bóveda. */
export async function fetchVaultRecord(uid: string): Promise<VaultRecord | null> {
  const ref = doc(FirebaseDB, vaultDocPath(uid));
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data() as VaultRecord;
}

/**
 * Guarda el record (creación, cambio de contraseña o nuevo código).
 *
 * Se escribe el documento completo a propósito: el record es pequeño y sus
 * campos están acoplados entre sí (un salt sin su envoltorio correspondiente
 * deja la cuenta inaccesible). Un merge parcial podría dejar una combinación
 * incoherente que no abre con ninguna contraseña.
 */
export async function saveVaultRecord(
  uid: string,
  record: VaultRecord
): Promise<void> {
  const ref = doc(FirebaseDB, vaultDocPath(uid));
  await setDoc(ref, record);
}

/** ¿Este usuario ya tiene bóveda? */
export async function hasVault(uid: string): Promise<boolean> {
  return (await fetchVaultRecord(uid)) !== null;
}
