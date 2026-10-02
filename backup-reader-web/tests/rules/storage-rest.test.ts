import { describe, it, expect } from "vitest";

/**
 * Pruebas de las reglas de Storage, hablando REST directo con el emulador.
 *
 * Requiere el emulador corriendo:
 *   npm run emulators
 *
 * Por qué sin SDK: el SDK de Storage usa XMLHttpRequest, que no existe en Node.
 * Bajo vitest, las peticiones con cuerpo nunca se completan y el SDK reintenta
 * hasta agotarse (storage/retry-limit-exceeded), sin llegar a evaluar nada.
 * Con fetch directo se prueba el mismo motor de reglas y en una fracción del
 * tiempo.
 *
 * Nota: el token va sin firmar. El emulador lo acepta; producción NO. Sirve
 * para probar reglas y para nada más.
 */

const EMU = "http://127.0.0.1:9199";
const BUCKET = "backup-reader-test.appspot.com";

function token(uid: string) {
  const b64 = (o: any) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${b64({ alg: "none", typ: "JWT" })}.${b64({
    sub: uid,
    user_id: uid,
    aud: "backup-reader-test",
    iss: "https://securetoken.google.com/backup-reader-test",
    firebase: { sign_in_provider: "password" },
  })}.`;
}

const auth = (uid: string | null) =>
  uid ? { Authorization: `Bearer ${token(uid)}` } : {};

async function subir(
  uid: string | null,
  ruta: string,
  tipo = "application/octet-stream"
) {
  const r = await fetch(`${EMU}/v0/b/${BUCKET}/o?name=${encodeURIComponent(ruta)}`, {
    method: "POST",
    headers: { "Content-Type": tipo, ...auth(uid) },
    body: new Uint8Array(16),
  });
  return r.status;
}

async function leer(uid: string | null, ruta: string) {
  const r = await fetch(
    `${EMU}/v0/b/${BUCKET}/o/${encodeURIComponent(ruta)}?alt=media`,
    { headers: auth(uid) }
  );
  return r.status;
}

async function borrar(uid: string | null, ruta: string) {
  const r = await fetch(`${EMU}/v0/b/${BUCKET}/o/${encodeURIComponent(ruta)}`, {
    method: "DELETE",
    headers: auth(uid),
  });
  return r.status;
}

async function listar(uid: string | null, prefijo: string) {
  /* El emulador exige que `prefix` termine en "/" y devuelve 400 si no, ANTES
     de evaluar las reglas. Sin esta barra, la petición ni llega al motor de
     reglas y la prueba pasaría o fallaría por el motivo equivocado. */
  const p = prefijo.endsWith("/") ? prefijo : prefijo + "/";
  const r = await fetch(
    `${EMU}/v0/b/${BUCKET}/o?prefix=${encodeURIComponent(p)}`,
    { headers: auth(uid) }
  );
  return r.status;
}
/** Sube saltándose las reglas, para preparar el escenario de una prueba. */
async function sembrar(ruta: string) {
  const estado = await subir(ANA, ruta);
  if (estado >= 300) throw new Error(`no se pudo sembrar ${ruta}: ${estado}`);
}

const ANA = "uid-ana";
const BETO = "uid-beto";
const PIEZA = `backups/${ANA}/b1/p/p1`;
const MANIFIESTO = `backups/${ANA}/b1/manifest`;
const RUTA_V1 = `backups/${ANA}/whatsapp/Chat con X/IMG-01.jpg`;

const permitido = (estado: number) => expect(estado).toBeLessThan(300);
const denegado = (estado: number) => expect(estado).toBe(403);

describe("propiedad del prefijo", () => {
  it("el dueño sube su pieza", async () => {
    permitido(await subir(ANA, PIEZA));
  });

  it("el dueño lee su pieza", async () => {
    await sembrar(PIEZA);
    permitido(await leer(ANA, PIEZA));
  });

  it("el dueño borra su pieza", async () => {
    await sembrar(PIEZA);
    permitido(await borrar(ANA, PIEZA));
  });

  it("otro usuario NO puede escribir en el prefijo ajeno", async () => {
    denegado(await subir(BETO, PIEZA));
  });

  it("otro usuario NO puede leer la pieza ajena", async () => {
    await sembrar(PIEZA);
    denegado(await leer(BETO, PIEZA));
  });

  it("otro usuario NO puede borrar la pieza ajena", async () => {
    await sembrar(PIEZA);
    denegado(await borrar(BETO, PIEZA));
  });

  it("otro usuario NO puede listar el prefijo ajeno", async () => {
    // Listar filtraría cuántos backups y cuántas piezas tiene Ana.
    denegado(await listar(BETO, `backups/${ANA}`));
  });

  it("sin sesión no se accede a nada", async () => {
    await sembrar(PIEZA);
    denegado(await subir(null, PIEZA));
    denegado(await leer(null, PIEZA));
    denegado(await borrar(null, PIEZA));
  });
});

describe("content-type", () => {
  it("acepta los blobs cifrados", async () => {
    permitido(await subir(ANA, PIEZA, "application/octet-stream"));
  });

  it("RECHAZA zip: ya no se sube texto plano (Etapa 8)", async () => {
    // Esta prueba estaba invertida hasta la Etapa 7: el zip se aceptaba para no
    // romper a quien tuviera el bundle viejo en caché. Ahora el zip se
    // descomprime y se cifra en el navegador y nunca sale de ahí, así que
    // aceptarlo solo dejaría una puerta abierta a subir texto plano.
    denegado(await subir(ANA, `backups/${ANA}/b1/p/p1`, "application/zip"));
  });

  it("rechaza otros content-types", async () => {
    denegado(await subir(ANA, PIEZA, "text/plain"));
    denegado(await subir(ANA, PIEZA, "image/jpeg"));
  });
});

describe("rutas fuera de backups/", () => {
  it("quedan cerradas", async () => {
    denegado(await subir(ANA, "otraCosa/archivo"));
    denegado(await leer(ANA, "otraCosa/archivo"));
  });
});

describe("forma de la ruta", () => {
  it("el manifiesto se trata como cualquier otro blob del dueño", async () => {
    permitido(await subir(ANA, MANIFIESTO));
    permitido(await leer(ANA, MANIFIESTO));
    denegado(await leer(BETO, MANIFIESTO));
  });

  it("NO se puede escribir fuera de manifest y p/ (Etapa 8)", async () => {
    // Antes bastaba con ser el dueño del prefijo, así que un bug del cliente
    // podía sembrar un árbol arbitrario dentro de backups/{uid}/.
    denegado(await subir(ANA, RUTA_V1));
    denegado(await subir(ANA, `backups/${ANA}/b1/cualquiera`));
    denegado(await subir(ANA, `backups/${ANA}/b1/p/sub/demasiado-hondo`));
  });

  /* La lectura y el borrado siguen cubriendo backups/{uid}/** entero para que
     el dueño pueda barrer restos de la época en texto plano. No se prueba aquí
     con una ruta v1 porque ya no se puede sembrar una: escribirla es justo lo
     que la prueba de arriba comprueba que está prohibido. Que el dueño lee y
     borra su propio prefijo lo cubren las dos primeras pruebas del archivo. */
});
