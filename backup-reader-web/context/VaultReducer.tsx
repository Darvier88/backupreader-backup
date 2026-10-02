/**
 * Estado de la bóveda criptográfica.
 *
 *   checking  → aún no sabemos si el usuario tiene bóveda (o no hay sesión)
 *   none      → sesión iniciada, pero nunca creó bóveda
 *   locked    → tiene bóveda, pero la DEK no está en memoria
 *   unlocked  → la DEK está en memoria y se puede cifrar/descifrar
 *
 * La DEK vive SOLO aquí, en memoria. Al recargar la página se pierde y hay que
 * volver a introducir la contraseña. Eso es correcto, no un fallo: guardarla en
 * localStorage o sessionStorage la dejaría legible para cualquier script.
 */

import type { VaultRecord } from "../lib/backupreader-crypto";

export type VaultStatus = "checking" | "none" | "locked" | "unlocked";

export interface VaultState {
  status: VaultStatus;
  record: VaultRecord | null;
  dek: Uint8Array | null;
  uid: string | null;
  errorMessage: string;
  /** Código de recuperación recién generado, para mostrarlo UNA vez. */
  pendingRecoveryCode: string | null;
}

export const vaultInitialState: VaultState = {
  status: "checking",
  record: null,
  dek: null,
  uid: null,
  errorMessage: "",
  pendingRecoveryCode: null,
};

export type VaultAction =
  | { type: "checking" }
  | { type: "noSession" }
  | { type: "sessionStarted"; payload: { uid: string } }
  | { type: "recordLoaded"; payload: { record: VaultRecord | null } }
  | { type: "unlocked"; payload: { dek: Uint8Array } }
  | { type: "registered"; payload: { record: VaultRecord; dek: Uint8Array; recoveryCode: string } }
  | { type: "recordUpdated"; payload: { record: VaultRecord } }
  | { type: "recoveryRegenerated"; payload: { record: VaultRecord; recoveryCode: string } }
  | { type: "recoveryCodeSeen" }
  | { type: "lock" }
  | { type: "addError"; payload: string }
  | { type: "removeError" };

export const vaultReducer = (
  state: VaultState,
  action: VaultAction
): VaultState => {
  switch (action.type) {
    case "checking":
      return { ...state, status: "checking" };

    case "noSession":
      // Cerrar sesión borra todo rastro de la bóveda del estado.
      return { ...vaultInitialState, status: "checking" };

    case "sessionStarted":
      return { ...state, uid: action.payload.uid, status: "checking" };

    case "recordLoaded":
      return {
        ...state,
        record: action.payload.record,
        status: action.payload.record ? "locked" : "none",
      };

    case "unlocked":
      return {
        ...state,
        dek: action.payload.dek,
        status: "unlocked",
        errorMessage: "",
      };

    case "registered":
      return {
        ...state,
        record: action.payload.record,
        dek: action.payload.dek,
        pendingRecoveryCode: action.payload.recoveryCode,
        status: "unlocked",
        errorMessage: "",
      };

    case "recordUpdated":
      return { ...state, record: action.payload.record, errorMessage: "" };

    case "recoveryRegenerated":
      return {
        ...state,
        record: action.payload.record,
        pendingRecoveryCode: action.payload.recoveryCode,
        errorMessage: "",
      };

    case "recoveryCodeSeen":
      // El código se muestra una sola vez y no queda en el estado.
      return { ...state, pendingRecoveryCode: null };

    case "lock":
      // Se conserva el record (sabemos que tiene bóveda), se tira la DEK.
      return { ...state, dek: null, status: state.record ? "locked" : "none" };

    case "addError":
      return { ...state, errorMessage: action.payload };

    case "removeError":
      return { ...state, errorMessage: "" };

    default:
      return state;
  }
};
