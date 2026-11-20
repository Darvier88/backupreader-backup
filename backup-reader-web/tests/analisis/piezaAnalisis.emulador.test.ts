import { describe, it, expect, beforeAll } from "vitest";
import { ID_PIEZA_ANALISIS } from "../../lib/analisis/piezaAnalisis";

/**
 * Lo que hay que confirmar ANTES de guardar nada: que una pieza se puede
 * añadir a un backup que ya existe sin tocar las reglas, que cuenta en el
 * espacio ocupado y que se va con el chat cuando se borra.
 *
 * Se habla REST directo con los emuladores, por lo mismo que
 * `tests/rules/storage-rest.test.ts`: el SDK de Storage necesita
 * XMLHttpRequest y en Node no lo hay.
 *
 * Requiere los emuladores:
 *   npm run emulators
 */

const STORAGE = "http://127.0.0.1:9199";
const FIRESTORE = "http://127.0.0.1:8080";
const BUCKET = "backup-reader-test.appspot.com";
const PROYECTO = "backup-reader-test";

const UID = "duenyo-analisis";
const OTRO = "intruso";
const BACKUP = "backup-de-prueba";

const prefijo = `backups/${UID}/${BACKUP}`;
const rutaPieza = `${prefijo}/p/${ID_PIEZA_ANALISIS}`;

function token(uid: string) {
  const b64 = (o: any) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${b64({ alg: "none", typ: "JWT" })}.${b64({
    sub: uid,
    user_id: uid,
    aud: PROYECTO,
    iss: `https://securetoken.google.com/${PROYECTO}`,
    firebase: { sign_in_provider: "password" },
  })}.`;
}

/* `Record<string, string>` y no un objeto literal: si no, TypeScript ve una
   unión con `Authorization` opcional y deja de aceptarla como cabeceras. */
const auth = (uid: string | null): Record<string, string> =>
  uid ? { Authorization: `Bearer ${token(uid)}` } : {};

const subir = async (uid: string | null, ruta: string, bytes = 64) =>
  (
    await fetch(`${STORAGE}/v0/b/${BUCKET}/o?name=${encodeURIComponent(ruta)}`, {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream", ...auth(uid) },
      body: new Uint8Array(bytes),
    })
  ).status;

const listar = async (uid: string | null, pre: string) => {
  const r = await fetch(
    `${STORAGE}/v0/b/${BUCKET}/o?prefix=${encodeURIComponent(pre + "/")}`,
    { headers: auth(uid) }
  );
  const cuerpo = await r.json().catch(() => ({}));
  return { estado: r.status, rutas: (cuerpo.items || []).map((i: any) => i.name) };
};

const borrar = async (uid: string | null, ruta: string) =>
  (
    await fetch(`${STORAGE}/v0/b/${BUCKET}/o/${encodeURIComponent(ruta)}`, {
      method: "DELETE",
      headers: auth(uid),
    })
  ).status;

/**
 * Escribe el documento del backup pasando por las reglas de Firestore.
 *
 * Con `parcial`, manda la máscara de campos: un PATCH sin máscara reemplaza
 * el documento entero, y entonces el resultante se queda sin `pieceCount` ni
 * `encVersion` y las reglas lo rechazan, con razón. La máscara es lo que el
 * SDK manda cuando se usa `setDoc(..., { merge: true })`, que es como escribe
 * el cliente de verdad.
 */
const escribirDoc = async (
  uid: string | null,
  campos: Record<string, any>,
  parcial = false
) => {
  const ruta = `vaults/${UID}/backups/${BACKUP}`;
  const valores: Record<string, any> = {};
  for (const [k, v] of Object.entries(campos)) valores[k] = { integerValue: String(v) };
  const mascara = parcial
    ? "?" + Object.keys(campos).map((k) => `updateMask.fieldPaths=${k}`).join("&")
    : "";
  const r = await fetch(
    `${FIRESTORE}/v1/projects/${PROYECTO}/databases/(default)/documents/${ruta}${mascara}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...auth(uid) },
      body: JSON.stringify({ fields: valores }),
    }
  );
  return r.status;
};

const leerDoc = async (uid: string | null) => {
  const r = await fetch(
    `${FIRESTORE}/v1/projects/${PROYECTO}/databases/(default)/documents/vaults/${UID}/backups/${BACKUP}`,
    { headers: auth(uid) }
  );
  const cuerpo = await r.json().catch(() => ({}));
  return Number(cuerpo?.fields?.cipherBytes?.integerValue ?? NaN);
};

const emuladoresVivos = async () => {
  try {
    await fetch(`${STORAGE}/`, { method: "HEAD" });
    return true;
  } catch {
    return false;
  }
};

describe("una pieza de análisis en un backup que ya existe", () => {
  beforeAll(async () => {
    if (!(await emuladoresVivos())) throw new Error("hacen falta los emuladores");
    /* El backup ya está ahí: manifiesto, una pieza y su registro. */
    await subir(UID, `${prefijo}/manifest`, 128);
    await subir(UID, `${prefijo}/p/11111111-1111-4111-8111-111111111111`, 1000);
    await escribirDoc(UID, {
      createdAt: Date.now(),
      pieceCount: 1,
      cipherBytes: 1128,
      encVersion: 2,
    });
  });

  it("1. las reglas ya dejan añadirla: va en p/, como el índice de búsqueda", async () => {
    expect(await subir(UID, rutaPieza)).toBe(200);
  });

  it("y siguen sin dejar que la escriba otro", async () => {
    expect(await subir(OTRO, rutaPieza)).toBe(403);
  });

  it("no hace falta ninguna ruta nueva ni desplegar storage.rules", async () => {
    /* Una ruta fuera de las dos permitidas se rechaza; por eso la pieza va
       donde van las demás y no en un sitio propio. */
    expect(await subir(UID, `${prefijo}/analisis`)).toBe(403);
  });

  it("2. cuenta en el espacio ocupado, que sale de cipherBytes en Firestore", async () => {
    /* Storage no suma solo: el espacio se lee del registro del backup. Las
       reglas permiten actualizarlo mientras el documento siga teniendo sus
       campos. */
    const antes = await leerDoc(UID);
    expect(
      await escribirDoc(UID, { cipherBytes: antes + 2048, anaBytes: 2048 }, true)
    ).toBe(200);
    expect(await leerDoc(UID)).toBe(antes + 2048);
  });

  it("y recalcular no suma dos veces: se resta lo que ocupaba antes", async () => {
    /* Es lo que hace `anotarAnalisis`: base = cipherBytes - anaBytes. */
    const total = await leerDoc(UID);
    const base = total - 2048;
    expect(
      await escribirDoc(UID, { cipherBytes: base + 3000, anaBytes: 3000 }, true)
    ).toBe(200);
    expect(await leerDoc(UID)).toBe(base + 3000);
  });

  it("pero otro usuario no puede tocar ese registro", async () => {
    expect(await escribirDoc(OTRO, { cipherBytes: 1 }, true)).toBe(403);
  });

  it("3. se va con el chat: el borrado lista el prefijo entero", async () => {
    const { rutas } = await listar(UID, prefijo);
    expect(rutas).toContain(rutaPieza);
    /* Y el dueño puede borrarla, que es lo que hace el barrido. */
    expect(await borrar(UID, rutaPieza)).toBe(204);
    const despues = await listar(UID, prefijo);
    expect(despues.rutas).not.toContain(rutaPieza);
  });
});
