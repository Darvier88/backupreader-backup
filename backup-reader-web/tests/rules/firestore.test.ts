import { readFileSync } from "fs";
import { resolve } from "path";
import { beforeAll, afterAll, beforeEach, describe, it } from "vitest";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  collection,
  query,
  where,
} from "firebase/firestore";

/**
 * Pruebas de las reglas de Firestore.
 *
 * Requiere el emulador corriendo:
 *   npm run emulators
 *
 * Lo que se verifica no es "funciona la app", sino "un usuario no puede tocar
 * lo de otro". Es el único punto de la Fase 2 donde un error no se nota hasta
 * que alguien lo explota.
 */

let env: RulesTestEnvironment;

const ANA = "uid-ana";
const BETO = "uid-beto";

const recordValido = {
  version: 1,
  kdf: { alg: "argon2id", memMiB: 64, ops: 3 },
  pwSalt: "c2FsdC1kZS1wcnVlYmE=",
  recSalt: "b3Ryby1zYWx0LWRlLXBydWViYQ==",
  wrapPassword: { n: "bm9uY2U=", c: "Y2lwaGVy" },
  wrapRecovery: { n: "bm9uY2Uy", c: "Y2lwaGVyMg==" },
};

const backupValido = {
  createdAt: 1758600000000,
  pieceCount: 42,
  cipherBytes: 123456,
  encVersion: 2,
  fmt: 1,
};

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

const comoAna = () => env.authenticatedContext(ANA).firestore();
const comoBeto = () => env.authenticatedContext(BETO).firestore();
const sinSesion = () => env.unauthenticatedContext().firestore();

describe("vaults/{uid}", () => {
  it("el dueño crea y lee su record", async () => {
    const db = comoAna();
    await assertSucceeds(setDoc(doc(db, "vaults", ANA), recordValido));
    await assertSucceeds(getDoc(doc(db, "vaults", ANA)));
  });

  it("otro usuario NO puede leer el record ajeno", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "vaults", ANA), recordValido);
    });
    await assertFails(getDoc(doc(comoBeto(), "vaults", ANA)));
  });

  it("otro usuario NO puede sobrescribir el record ajeno", async () => {
    // Este es el ataque que importa: sobrescribir el record con uno propio
    // dejaría la cuenta de Ana inaccesible para siempre.
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "vaults", ANA), recordValido);
    });
    await assertFails(setDoc(doc(comoBeto(), "vaults", ANA), recordValido));
  });

  it("sin sesión no se puede leer nada", async () => {
    await assertFails(getDoc(doc(sinSesion(), "vaults", ANA)));
  });

  it("NADIE puede borrar un record, ni su dueño", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "vaults", ANA), recordValido);
    });
    await assertFails(deleteDoc(doc(comoAna(), "vaults", ANA)));
  });

  it("rechaza un record con campos faltantes", async () => {
    const { wrapRecovery, ...roto } = recordValido;
    await assertFails(setDoc(doc(comoAna(), "vaults", ANA), roto));
  });

  it("rechaza un record con salt vacío", async () => {
    await assertFails(
      setDoc(doc(comoAna(), "vaults", ANA), { ...recordValido, pwSalt: "" })
    );
  });

  it("permite actualizar el record al cambiar contraseña", async () => {
    const db = comoAna();
    await assertSucceeds(setDoc(doc(db, "vaults", ANA), recordValido));
    await assertSucceeds(
      updateDoc(doc(db, "vaults", ANA), {
        pwSalt: "bnVldm8tc2FsdA==",
        wrapPassword: { n: "bnVldm8=", c: "bnVldm8y" },
      })
    );
  });
});

describe("vaults/{uid}/backups/{backupId}", () => {
  it("el dueño crea, lee y borra sus backups", async () => {
    const db = comoAna();
    const ref = doc(db, "vaults", ANA, "backups", "backup-1");
    await assertSucceeds(setDoc(ref, backupValido));
    await assertSucceeds(getDoc(ref));
    await assertSucceeds(deleteDoc(ref));
  });

  it("otro usuario NO ve los backups ajenos", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "vaults", ANA, "backups", "b1"), backupValido);
    });
    await assertFails(getDoc(doc(comoBeto(), "vaults", ANA, "backups", "b1")));
    await assertFails(getDocs(collection(comoBeto(), "vaults", ANA, "backups")));
  });

  it("rechaza encVersion distinto de 2", async () => {
    await assertFails(
      setDoc(doc(comoAna(), "vaults", ANA, "backups", "b1"), {
        ...backupValido,
        encVersion: 1,
      })
    );
  });

  it("rechaza cipherBytes negativo", async () => {
    await assertFails(
      setDoc(doc(comoAna(), "vaults", ANA, "backups", "b1"), {
        ...backupValido,
        cipherBytes: -1,
      })
    );
  });
});

describe("users/{uid}", () => {
  it("el dueño lee y escribe su perfil por id", async () => {
    const db = comoAna();
    await assertSucceeds(setDoc(doc(db, "users", ANA), { user: { uid: ANA } }));
    await assertSucceeds(getDoc(doc(db, "users", ANA)));
  });

  it("no se puede leer el perfil de otro", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "users", ANA), { user: { uid: ANA } });
    });
    await assertFails(getDoc(doc(comoBeto(), "users", ANA)));
  });

  it("NO se puede enumerar la colección users", async () => {
    // Esta es la razón por la que hay que cambiar FirestoreContext: la consulta
    // con where() necesita 'list', y conceder 'list' deja enumerar a todos.
    const db = comoAna();
    await assertFails(getDocs(collection(db, "users")));
    await assertFails(
      getDocs(query(collection(db, "users"), where("user.uid", "==", ANA)))
    );
  });

  it("nadie puede borrar un perfil", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "users", ANA), { user: { uid: ANA } });
    });
    await assertFails(deleteDoc(doc(comoAna(), "users", ANA)));
  });
});

describe("plans y userStatus", () => {
  it("un usuario autenticado lee el catálogo de planes", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "plans", "pro"), { plan: { precio: 5 } });
    });
    await assertSucceeds(getDocs(collection(comoAna(), "plans")));
  });

  it("el cliente NO puede escribir planes", async () => {
    await assertFails(setDoc(doc(comoAna(), "plans", "gratis"), { plan: { precio: 0 } }));
  });

  it("el dueño lee su userStatus pero no lo escribe", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "userStatus", ANA), { status: "listo" });
    });
    await assertSucceeds(getDoc(doc(comoAna(), "userStatus", ANA)));
    await assertFails(setDoc(doc(comoAna(), "userStatus", ANA), { status: "hackeado" }));
  });

  it("no se lee el userStatus de otro", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "userStatus", ANA), { status: "listo" });
    });
    await assertFails(getDoc(doc(comoBeto(), "userStatus", ANA)));
  });
});

describe("colecciones no declaradas", () => {
  it("quedan cerradas por defecto", async () => {
    const db = comoAna();
    await assertFails(getDoc(doc(db, "loQueSea", "x")));
    await assertFails(setDoc(doc(db, "loQueSea", "x"), { a: 1 }));
  });
});
