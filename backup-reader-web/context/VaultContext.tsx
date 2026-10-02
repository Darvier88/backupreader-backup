import { createContext, useContext, useEffect, useReducer, useRef } from "react";
import { onAuthStateChanged } from "firebase/auth";

import { FirebaseAuth } from "../config/firebase";
import { fetchVaultRecord, saveVaultRecord } from "../config/vaultRepo";
import { vaultReducer, vaultInitialState, type VaultStatus } from "./VaultReducer";

/**
 * Bóveda criptográfica: la DEK vive aquí, en memoria, y en ningún otro sitio.
 *
 * Decisiones que conviene no revertir sin pensarlo:
 *
 *  - La DEK NO se guarda en localStorage, sessionStorage, cookies ni IndexedDB.
 *    Al recargar la página se pierde y hay que volver a desbloquear. Es el
 *    comportamiento correcto para E2EE: si la clave sobrevive a la recarga,
 *    sobrevive también a cualquier script que se cuele en la página.
 *
 *  - Este contexto escucha `onAuthStateChanged` por su cuenta en vez de
 *    depender de AuthContext. Así no hay que ordenar providers ni crear una
 *    dependencia circular, y al cerrar sesión la DEK se borra sola.
 *
 *  - Todo el módulo criptográfico se importa de forma diferida (import
 *    dinámico): libsodium carga WASM y revienta en el render de servidor.
 */

const AUTO_LOCK_MS = 20 * 60 * 1000; // 20 minutos de inactividad

type VaultContextProps = {
  status: VaultStatus;
  dek: Uint8Array | null;
  errorMessage: string;
  /** Código de recuperación recién generado. Se muestra UNA vez. */
  pendingRecoveryCode: string | null;
  /** Crea la bóveda. Devuelve el código de recuperación, o null si falló. */
  registerVault: (password: string) => Promise<string | null>;
  unlock: (password: string) => Promise<boolean>;
  unlockWithCode: (recoveryCode: string) => Promise<boolean>;
  changeVaultPassword: (current: string, next: string) => Promise<boolean>;
  regenerateRecovery: () => Promise<string | null>;
  /** Marca el código como ya mostrado y lo quita del estado. */
  acknowledgeRecoveryCode: () => void;
  lock: () => void;
  clearError: () => void;
};

export const VaultContext = createContext({} as VaultContextProps);

export const VaultProvider = ({ children }: any) => {
  const [state, dispatch] = useReducer(vaultReducer, vaultInitialState);
  const dekRef = useRef<Uint8Array | null>(null);

  // El módulo se carga solo en el navegador y solo cuando hace falta.
  const cripto = () => import("../lib/backupreader-crypto");

  // --- Sesión: cargar el record al entrar, borrar la DEK al salir ---
  useEffect(() => {
    const unsub = onAuthStateChanged(FirebaseAuth, async (user) => {
      if (!user) {
        await wipeDek();
        dispatch({ type: "noSession" });
        return;
      }
      dispatch({ type: "sessionStarted", payload: { uid: user.uid } });
      try {
        const record = await fetchVaultRecord(user.uid);
        dispatch({ type: "recordLoaded", payload: { record } });
      } catch (err) {
        console.error("No se pudo leer el registro de la bóveda", err);
        dispatch({ type: "recordLoaded", payload: { record: null } });
      }
    });
    return unsub;
  }, []);

  const wipeDek = async () => {
    if (!dekRef.current) return;
    try {
      const { lockVault } = await cripto();
      await lockVault(dekRef.current);
    } catch {
      dekRef.current.fill(0);
    }
    dekRef.current = null;
  };

  const lock = () => {
    void wipeDek();
    dispatch({ type: "lock" });
  };

  // --- Auto-bloqueo por inactividad ---
  useEffect(() => {
    if (state.status !== "unlocked") return;
    if (typeof window === "undefined") return;

    let timer: ReturnType<typeof setTimeout>;
    const reiniciar = () => {
      clearTimeout(timer);
      timer = setTimeout(lock, AUTO_LOCK_MS);
    };

    const eventos = ["mousedown", "keydown", "touchstart", "scroll"] as const;
    eventos.forEach((e) => window.addEventListener(e, reiniciar, { passive: true }));
    reiniciar();

    return () => {
      clearTimeout(timer);
      eventos.forEach((e) => window.removeEventListener(e, reiniciar));
    };
  }, [state.status]);

  // --- Operaciones ---

  const registerVault = async (password: string): Promise<string | null> => {
    if (!state.uid) return null;
    try {
      const { createVault } = await cripto();
      const { record, recoveryCode, dek } = await createVault(password);
      await saveVaultRecord(state.uid, record);
      dekRef.current = dek;
      dispatch({ type: "registered", payload: { record, dek, recoveryCode } });
      return recoveryCode;
    } catch (err) {
      console.error("No se pudo crear la bóveda", err);
      dispatch({ type: "addError", payload: "registerFail" });
      return null;
    }
  };

  const unlock = async (password: string): Promise<boolean> => {
    if (!state.record) return false;
    try {
      const { unlockWithPassword } = await cripto();
      const dek = await unlockWithPassword(state.record, password);
      if (!dek) {
        dispatch({ type: "addError", payload: "wrongPassword" });
        return false;
      }
      dekRef.current = dek;
      dispatch({ type: "unlocked", payload: { dek } });
      return true;
    } catch (err) {
      console.error("Fallo al desbloquear", err);
      dispatch({ type: "addError", payload: "unlockFail" });
      return false;
    }
  };

  const unlockWithCode = async (recoveryCode: string): Promise<boolean> => {
    if (!state.record) return false;
    try {
      const { unlockWithRecovery } = await cripto();
      const dek = await unlockWithRecovery(state.record, recoveryCode);
      if (!dek) {
        dispatch({ type: "addError", payload: "wrongRecoveryCode" });
        return false;
      }
      dekRef.current = dek;
      dispatch({ type: "unlocked", payload: { dek } });
      return true;
    } catch (err) {
      console.error("Fallo al desbloquear con código", err);
      dispatch({ type: "addError", payload: "unlockFail" });
      return false;
    }
  };

  /**
   * Cambia la contraseña sin re-cifrar los datos: solo re-envuelve la DEK.
   *
   * Pide la contraseña actual aunque la bóveda esté abierta. Con la sesión ya
   * desbloqueada bastaría la DEK en memoria, pero exigirla evita que alguien
   * que encuentre el equipo desatendido se apropie de la cuenta.
   */
  const changeVaultPassword = async (
    current: string,
    next: string
  ): Promise<boolean> => {
    if (!state.uid || !state.record) return false;
    try {
      const { unlockWithPassword, changePassword } = await cripto();
      const dek = await unlockWithPassword(state.record, current);
      if (!dek) {
        dispatch({ type: "addError", payload: "wrongPassword" });
        return false;
      }
      const updated = await changePassword(state.record, dek, next);
      await saveVaultRecord(state.uid, updated);
      dekRef.current = dek;
      dispatch({ type: "recordUpdated", payload: { record: updated } });
      dispatch({ type: "unlocked", payload: { dek } });
      return true;
    } catch (err) {
      console.error("No se pudo cambiar la contraseña", err);
      dispatch({ type: "addError", payload: "changePasswordFail" });
      return false;
    }
  };

  /** Genera un código de recuperación nuevo. Invalida el anterior. */
  const regenerateRecovery = async (): Promise<string | null> => {
    if (!state.uid || !state.record || !dekRef.current) return null;
    try {
      const { resetRecoveryCode } = await cripto();
      const { record, recoveryCode } = await resetRecoveryCode(
        state.record,
        dekRef.current
      );
      await saveVaultRecord(state.uid, record);
      dispatch({ type: "recoveryRegenerated", payload: { record, recoveryCode } });
      return recoveryCode;
    } catch (err) {
      console.error("No se pudo regenerar el código", err);
      dispatch({ type: "addError", payload: "recoveryFail" });
      return null;
    }
  };

  const acknowledgeRecoveryCode = () => dispatch({ type: "recoveryCodeSeen" });
  const clearError = () => dispatch({ type: "removeError" });

  return (
    <VaultContext.Provider
      value={{
        status: state.status,
        dek: state.dek,
        errorMessage: state.errorMessage,
        pendingRecoveryCode: state.pendingRecoveryCode,
        registerVault,
        unlock,
        unlockWithCode,
        changeVaultPassword,
        regenerateRecovery,
        acknowledgeRecoveryCode,
        lock,
        clearError,
      }}
    >
      {children}
    </VaultContext.Provider>
  );
};

/** Atajo para consumir la bóveda desde cualquier componente. */
export const useVault = () => useContext(VaultContext);
