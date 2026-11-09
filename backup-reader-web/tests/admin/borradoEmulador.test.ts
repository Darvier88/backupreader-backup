import { describe, it, expect } from "vitest";

/**
 * El borrado de una cuenta, de punta a punta, contra los emuladores.
 *
 * Los otros tests de administración usan dobles: comprueban la lógica y la
 * contabilidad, que es donde están los errores que importan, pero no que los
 * objetos se vayan de verdad de Storage ni que la cuenta desaparezca de Auth.
 * Eso solo se ve ejecutándolo contra algo que se comporte como Firebase.
 *
 * CÓMO SE CORRE
 * -------------
 *   # terminal 1
 *   npm run emulators
 *   # terminal 2
 *   NEXT_PUBLIC_USE_EMULATORS=1 npm run test:admin
 *
 * Sin emuladores levantados, estos casos se SALTAN en vez de fallar: un test
 * que se pone rojo por una dependencia que no está no dice nada sobre el
 * código, y acaba ignorado.
 *
 * Ojo al projectId: tiene que ser el mismo que usa la aplicación. Si la app
 * apunta a `backup-reader` y el emulador a `demo-backupreader`, son dos
 * espacios de nombres distintos y este test sembraría en uno y borraría en el
 * otro, saliendo verde sin haber comprobado nada.
 */

const HOST = process.env.NEXT_PUBLIC_EMULATOR_HOST || "127.0.0.1";
const PROYECTO = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "demo-backupreader";

async function responde(url: string): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 1500);
    await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    return true;
  } catch {
    return false;
  }
}

/**
 * La comprobación va en el cuerpo del módulo, con `await` de primer nivel, y
 * no en un `beforeAll`. Es para que `describe.skipIf` pueda decidir: si la
 * decisión se tomara dentro de cada caso con un `return` temprano, vitest los
 * contaría como PASADOS sin haber hecho nada, y un informe que dice "25
 * pasados" cuando dos no se ejecutaron es peor que no tenerlos.
 *
 * Hacen falta los tres emuladores: Auth para la cuenta, Firestore para los
 * documentos y Storage para los blobs. Con uno caído el test diría "borrado
 * completo" sin haber tocado una de las tres partes.
 */
const [emAuth, emFirestore, emStorage] = await Promise.all([
  responde(`http://${HOST}:9099/`),
  responde(`http://${HOST}:8080/`),
  responde(`http://${HOST}:9199/`),
]);
const hayEmuladores = emAuth && emFirestore && emStorage;

if (hayEmuladores) {
  process.env.NEXT_PUBLIC_USE_EMULATORS = "1";
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = PROYECTO;
  process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ??= `${PROYECTO}.appspot.com`;
} else {
  console.warn(
    `Emuladores no encontrados en ${HOST} (auth ${emAuth ? "ok" : "no"}, ` +
      `firestore ${emFirestore ? "ok" : "no"}, storage ${emStorage ? "ok" : "no"}). ` +
      "Se SALTAN los casos de borrado real. Levántalos con `npm run emulators`."
  );
}

describe.skipIf(!hayEmuladores)("borrado de cuenta contra los emuladores", () => {
  it("se va todo: Storage, Firestore y la cuenta de Auth", async () => {
    const { authAdmin, dbAdmin, bucketAdmin } = await import(
      "../../lib/admin-servidor"
    );
    const { borrarStorage, borrarFirestore } = await import(
      "../../lib/admin-borrado"
    );

    /* --- Sembrar una cuenta con todo lo que tiene un usuario real --- */
    const correo = `borrame-${Date.now()}@ejemplo.com`;
    const cuenta = await authAdmin().createUser({
      email: correo,
      password: "contraseña-de-prueba",
    });
    const uid = cuenta.uid;

    const db = dbAdmin();
    await db.collection("users").doc(uid).set({
      user: { uid, email: correo, plan: "plan-prueba", storageSize: 123 },
    });
    await db.collection("vaults").doc(uid).set({
      version: 2,
      kdf: { alg: "argon2id" },
      pwSalt: "sal",
      recSalt: "sal",
      wrapPassword: { n: "n", c: "c" },
      wrapRecovery: { n: "n", c: "c" },
    });
    await db.collection("userStatus").doc(uid).set({ estado: "listo" });
    for (const id of ["chat-1", "chat-2", "chat-3"]) {
      await db
        .collection("vaults")
        .doc(uid)
        .collection("backups")
        .doc(id)
        .set({ createdAt: Date.now(), pieceCount: 2, cipherBytes: 999, encVersion: 2 });
    }

    const bucket = bucketAdmin();
    const rutas = [
      `backups/${uid}/chat-1/manifest`,
      `backups/${uid}/chat-1/p/0`,
      `backups/${uid}/chat-1/p/1`,
      `backups/${uid}/chat-2/manifest`,
    ];
    for (const r of rutas) {
      await bucket.file(r).save(Buffer.from("cifrado-de-mentira"), {
        contentType: "application/octet-stream",
      });
    }

    /* Un usuario vecino, para comprobar que no se lo lleva por delante. */
    const vecino = await authAdmin().createUser({
      email: `vecino-${Date.now()}@ejemplo.com`,
      password: "contraseña-de-prueba",
    });
    await db.collection("users").doc(vecino.uid).set({ user: { uid: vecino.uid } });
    await bucket
      .file(`backups/${vecino.uid}/chat-1/manifest`)
      .save(Buffer.from("del vecino"), { contentType: "application/octet-stream" });

    /* Comprobar que lo sembrado está, para que el test no salga verde porque
       no había nada que borrar. */
    const [antes] = await bucket.getFiles({ prefix: `backups/${uid}/` });
    expect(antes.length).toBe(rutas.length);

    /* --- Borrar, en el mismo orden que el endpoint --- */
    const paso = await borrarStorage(uid);
    expect(paso.borrados).toBe(rutas.length);
    expect(paso.quedan).toBe(0);

    const fs = await borrarFirestore(uid);
    expect(fs.backups).toBe(3);

    await authAdmin().deleteUser(uid);

    /* --- Comprobar que no queda nada --- */
    const [despues] = await bucket.getFiles({ prefix: `backups/${uid}/` });
    expect(despues.length).toBe(0);

    for (const [col, id] of [
      ["users", uid],
      ["vaults", uid],
      ["userStatus", uid],
    ] as const) {
      const d = await db.collection(col).doc(id).get();
      expect(d.exists).toBe(false);
    }

    const sobrantes = await db
      .collection("vaults")
      .doc(uid)
      .collection("backups")
      .get();
    expect(sobrantes.empty).toBe(true);

    /* La subcolección es lo que más fácil se queda atrás: en Firestore vive
       independiente del padre, así que este `collectionGroup` es la
       comprobación que de verdad importa. Si quedara un documento, el usuario
       no saldría en el panel y sus chats seguirían contados. */
    const todos = await db.collectionGroup("backups").get();
    const mios = todos.docs.filter((d) => d.ref.parent.parent?.id === uid);
    expect(mios.length).toBe(0);

    await expect(authAdmin().getUser(uid)).rejects.toThrow();

    /* --- Y el vecino sigue intacto --- */
    const [delVecino] = await bucket.getFiles({ prefix: `backups/${vecino.uid}/` });
    expect(delVecino.length).toBe(1);
    const docVecino = await db.collection("users").doc(vecino.uid).get();
    expect(docVecino.exists).toBe(true);

    /* Limpieza. */
    await bucket.deleteFiles({ prefix: `backups/${vecino.uid}/` });
    await db.collection("users").doc(vecino.uid).delete();
    await authAdmin().deleteUser(vecino.uid);
  }, 60_000);

  it("borrar dos veces no revienta", async () => {
    /* Si Storage se queda a medias, el admin vuelve a lanzar el borrado sobre
       la misma cuenta. Repetirlo tiene que ser inofensivo, o un borrado
       interrumpido quedaría imposible de terminar. */
    const { authAdmin } = await import("../../lib/admin-servidor");
    const { borrarStorage, borrarFirestore } = await import(
      "../../lib/admin-borrado"
    );

    const cuenta = await authAdmin().createUser({
      email: `dosveces-${Date.now()}@ejemplo.com`,
      password: "contraseña-de-prueba",
    });

    await borrarStorage(cuenta.uid);
    await borrarFirestore(cuenta.uid);

    /* Segunda pasada sobre una cuenta ya vacía. */
    const paso = await borrarStorage(cuenta.uid);
    expect(paso).toEqual({ borrados: 0, fallidos: 0, quedan: 0 });
    const fs = await borrarFirestore(cuenta.uid);
    expect(fs.backups).toBe(0);
    expect(fs.perfil).toBe(true);

    await authAdmin().deleteUser(cuenta.uid);
  }, 60_000);
});
