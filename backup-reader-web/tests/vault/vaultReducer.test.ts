import { describe, it, expect } from "vitest";

import {
  vaultReducer,
  vaultInitialState,
  type VaultState,
} from "../../context/VaultReducer";
import type { VaultRecord } from "../../lib/backupreader-crypto";

/**
 * Pruebas de la máquina de estados de la bóveda.
 *
 * No tocan red ni criptografía: solo comprueban que el estado nunca se queda en
 * una combinación imposible. Lo que más importa es que la DEK desaparezca
 * cuando toca.
 */

const RECORD = {
  version: 1,
  kdf: { alg: "argon2id", memMiB: 64, ops: 3 },
  pwSalt: "c2FsdA==",
  recSalt: "b3Ryby1zYWx0",
  wrapPassword: { n: "bg==", c: "Yw==" },
  wrapRecovery: { n: "bjI=", c: "YzI=" },
} as VaultRecord;

const DEK = new Uint8Array(32).fill(7);

/** Aplica varias acciones seguidas partiendo del estado inicial. */
const correr = (...acciones: Parameters<typeof vaultReducer>[1][]): VaultState =>
  acciones.reduce(vaultReducer, vaultInitialState);

describe("arranque de sesión", () => {
  it("empieza comprobando", () => {
    expect(vaultInitialState.status).toBe("checking");
    expect(vaultInitialState.dek).toBeNull();
  });

  it("sin record, el usuario no tiene bóveda", () => {
    const s = correr(
      { type: "sessionStarted", payload: { uid: "u1" } },
      { type: "recordLoaded", payload: { record: null } }
    );
    expect(s.status).toBe("none");
    expect(s.dek).toBeNull();
  });

  it("con record, arranca bloqueada", () => {
    const s = correr(
      { type: "sessionStarted", payload: { uid: "u1" } },
      { type: "recordLoaded", payload: { record: RECORD } }
    );
    expect(s.status).toBe("locked");
    expect(s.dek).toBeNull();
  });
});

describe("desbloqueo y bloqueo", () => {
  it("desbloquear guarda la DEK", () => {
    const s = correr(
      { type: "sessionStarted", payload: { uid: "u1" } },
      { type: "recordLoaded", payload: { record: RECORD } },
      { type: "unlocked", payload: { dek: DEK } }
    );
    expect(s.status).toBe("unlocked");
    expect(s.dek).toEqual(DEK);
  });

  it("bloquear tira la DEK pero conserva el record", () => {
    const s = correr(
      { type: "sessionStarted", payload: { uid: "u1" } },
      { type: "recordLoaded", payload: { record: RECORD } },
      { type: "unlocked", payload: { dek: DEK } },
      { type: "lock" }
    );
    expect(s.status).toBe("locked");
    expect(s.dek).toBeNull();
    expect(s.record).not.toBeNull();
  });

  it("cerrar sesión borra TODO, incluido el record", () => {
    const s = correr(
      { type: "sessionStarted", payload: { uid: "u1" } },
      { type: "recordLoaded", payload: { record: RECORD } },
      { type: "unlocked", payload: { dek: DEK } },
      { type: "noSession" }
    );
    expect(s.dek).toBeNull();
    expect(s.record).toBeNull();
    expect(s.uid).toBeNull();
    expect(s.pendingRecoveryCode).toBeNull();
  });

  it("un error de contraseña no desbloquea nada", () => {
    const s = correr(
      { type: "sessionStarted", payload: { uid: "u1" } },
      { type: "recordLoaded", payload: { record: RECORD } },
      { type: "addError", payload: "wrongPassword" }
    );
    expect(s.status).toBe("locked");
    expect(s.dek).toBeNull();
    expect(s.errorMessage).toBe("wrongPassword");
  });

  it("desbloquear limpia el error anterior", () => {
    const s = correr(
      { type: "sessionStarted", payload: { uid: "u1" } },
      { type: "recordLoaded", payload: { record: RECORD } },
      { type: "addError", payload: "wrongPassword" },
      { type: "unlocked", payload: { dek: DEK } }
    );
    expect(s.errorMessage).toBe("");
  });
});

describe("registro y código de recuperación", () => {
  it("registrar deja la bóveda abierta y el código pendiente de mostrar", () => {
    const s = correr(
      { type: "sessionStarted", payload: { uid: "u1" } },
      { type: "recordLoaded", payload: { record: null } },
      {
        type: "registered",
        payload: { record: RECORD, dek: DEK, recoveryCode: "AAAA-BBBB" },
      }
    );
    expect(s.status).toBe("unlocked");
    expect(s.pendingRecoveryCode).toBe("AAAA-BBBB");
  });

  it("el código desaparece del estado en cuanto se muestra", () => {
    const s = correr(
      { type: "sessionStarted", payload: { uid: "u1" } },
      {
        type: "registered",
        payload: { record: RECORD, dek: DEK, recoveryCode: "AAAA-BBBB" },
      },
      { type: "recoveryCodeSeen" }
    );
    expect(s.pendingRecoveryCode).toBeNull();
    expect(s.status).toBe("unlocked"); // seguir abierta, solo se oculta el código
  });

  it("regenerar el código deja uno nuevo pendiente", () => {
    const s = correr(
      { type: "sessionStarted", payload: { uid: "u1" } },
      { type: "recordLoaded", payload: { record: RECORD } },
      { type: "unlocked", payload: { dek: DEK } },
      {
        type: "recoveryRegenerated",
        payload: { record: RECORD, recoveryCode: "CCCC-DDDD" },
      }
    );
    expect(s.pendingRecoveryCode).toBe("CCCC-DDDD");
    expect(s.status).toBe("unlocked");
  });
});

describe("invariantes", () => {
  it("nunca hay DEK sin estar en unlocked", () => {
    const acciones: Parameters<typeof vaultReducer>[1][] = [
      { type: "checking" },
      { type: "noSession" },
      { type: "sessionStarted", payload: { uid: "u1" } },
      { type: "recordLoaded", payload: { record: RECORD } },
      { type: "unlocked", payload: { dek: DEK } },
      { type: "addError", payload: "x" },
      { type: "lock" },
      { type: "recordLoaded", payload: { record: null } },
      { type: "noSession" },
    ];

    let s = vaultInitialState;
    for (const a of acciones) {
      s = vaultReducer(s, a);
      if (s.dek !== null) expect(s.status).toBe("unlocked");
    }
  });

  it("una acción desconocida no cambia el estado", () => {
    const s = correr({ type: "sessionStarted", payload: { uid: "u1" } });
    expect(vaultReducer(s, { type: "loQueSea" } as never)).toEqual(s);
  });
});
