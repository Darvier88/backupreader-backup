import { readFileSync } from "fs";
import { resolve } from "path";
import { beforeAll, afterAll, beforeEach, describe, it, expect } from "vitest";
import {
  initializeTestEnvironment,
  assertFails,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";

import {
  createVault,
  unlockWithPassword,
  unlockWithRecovery,
  changePassword,
  resetRecoveryCode,
  encryptFile,
  decryptFile,
} from "../../lib/backupreader-crypto";

/**
 * Ciclo de vida completo de la bóveda, con criptografía real y las reglas
 * reales de Firestore.
 *
 * Esto es lo que de verdad importa de la Etapa 4: que un usuario pueda crear
 * la bóveda, cerrar el navegador, volver y recuperar EXACTAMENTE la misma DEK.
 * Si eso falla, los datos quedan inaccesibles para siempre.
 *
 * Requiere el emulador corriendo:
 *   npm run emulators
 */

let env: RulesTestEnvironment;

const ANA = "uid-ana";
const BETO = "uid-beto";
const PASSWORD = "contraseña-de-prueba-larga";

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "backup-reader-test",
    firestore: {
      rules: readFileSync(resolve(__dirname, "../../firestore.rules"), "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });
});

afterAll(async () => env?.cleanup());
beforeEach(async () => env.clearFirestore());

const db = (uid: string) => env.authenticatedContext(uid).firestore();

/** Simula lo que hace vaultRepo: guardar y leer el record. */
const guardar = (uid: string, record: any) =>
  setDoc(doc(db(uid), "vaults", uid), record);

const leer = async (uid: string) => {
  const snap = await getDoc(doc(db(uid), "vaults", uid));
  return snap.exists() ? (snap.data() as any) : null;
};

/** Compara dos claves sin depender de la representación. */
const mismaClave = (a: Uint8Array, b: Uint8Array) =>
  a.length === b.length && a.every((x, i) => x === b[i]);

describe("ciclo de vida de la bóveda", () => {
  it("crear, guardar, y desbloquear en una sesión nueva", async () => {
    // Sesión 1: el usuario crea la bóveda.
    const { record, recoveryCode, dek } = await createVault(PASSWORD);
    await guardar(ANA, record);

    // Sesión 2: navegador nuevo, solo tenemos lo que hay en el servidor.
    const guardado = await leer(ANA);
    expect(guardado).not.toBeNull();

    const dek2 = await unlockWithPassword(guardado, PASSWORD);
    expect(dek2).not.toBeNull();
    expect(mismaClave(dek!, dek2!)).toBe(true);

    // Y el código de recuperación abre la misma bóveda.
    const dek3 = await unlockWithRecovery(guardado, recoveryCode);
    expect(mismaClave(dek!, dek3!)).toBe(true);
  });

  it("una contraseña incorrecta no abre nada", async () => {
    const { record } = await createVault(PASSWORD);
    await guardar(ANA, record);
    const guardado = await leer(ANA);
    expect(await unlockWithPassword(guardado, "otra-cosa-cualquiera")).toBeNull();
  });

  it("el record guardado no filtra la contraseña ni la DEK", async () => {
    const { record, recoveryCode } = await createVault(PASSWORD);
    await guardar(ANA, record);

    const crudo = JSON.stringify(await leer(ANA));
    expect(crudo).not.toContain(PASSWORD);
    expect(crudo).not.toContain(recoveryCode);
    // Solo hay versión, parámetros de KDF, salts y envoltorios.
    expect(Object.keys(await leer(ANA)).sort()).toEqual([
      "kdf",
      "pwSalt",
      "recSalt",
      "version",
      "wrapPassword",
      "wrapRecovery",
    ]);
  });

  it("cambiar la contraseña conserva el acceso a los datos ya cifrados", async () => {
    // Un archivo cifrado ANTES del cambio de contraseña.
    const { record, dek } = await createVault(PASSWORD);
    await guardar(ANA, record);

    const original = new Blob([new Uint8Array([1, 2, 3, 4, 5])]);
    const cifrado = await encryptFile(original, dek);

    // El usuario cambia la contraseña.
    const actualizado = await changePassword(record, dek, "una-contraseña-nueva");
    await guardar(ANA, actualizado);

    // Sesión nueva, contraseña nueva.
    const guardado = await leer(ANA);
    const dek2 = await unlockWithPassword(guardado, "una-contraseña-nueva");
    expect(dek2).not.toBeNull();

    // Lo cifrado antes se sigue leyendo: cambiar contraseña NO re-cifra nada.
    const salida = await decryptFile(cifrado.header, cifrado.ciphertext, dek2!);
    expect(new Uint8Array(await salida.arrayBuffer())).toEqual(
      new Uint8Array([1, 2, 3, 4, 5])
    );

    // Y la contraseña vieja ya no sirve.
    expect(await unlockWithPassword(guardado, PASSWORD)).toBeNull();
  });

  it("regenerar el código de recuperación invalida el anterior", async () => {
    const { record, recoveryCode, dek } = await createVault(PASSWORD);
    await guardar(ANA, record);

    const { record: nuevo, recoveryCode: codigoNuevo } = await resetRecoveryCode(
      record,
      dek
    );
    await guardar(ANA, nuevo);

    const guardado = await leer(ANA);
    expect(await unlockWithRecovery(guardado, recoveryCode)).toBeNull();
    const dek2 = await unlockWithRecovery(guardado, codigoNuevo);
    expect(mismaClave(dek, dek2!)).toBe(true);
  });

  it("otro usuario no puede leer ni sobrescribir la bóveda ajena", async () => {
    const { record } = await createVault(PASSWORD);
    await guardar(ANA, record);

    await assertFails(getDoc(doc(db(BETO), "vaults", ANA)));
    // Sobrescribirla dejaría la cuenta de Ana inaccesible para siempre.
    const otro = await createVault("la-contraseña-del-atacante");
    await assertFails(setDoc(doc(db(BETO), "vaults", ANA), otro.record));
  });

  it("el dueño no puede borrar su propio record", async () => {
    // Borrarlo equivale a destruir los datos sin vuelta atrás.
    const { record } = await createVault(PASSWORD);
    await guardar(ANA, record);
    const { deleteDoc } = await import("firebase/firestore");
    await assertFails(deleteDoc(doc(db(ANA), "vaults", ANA)));
  });
});
