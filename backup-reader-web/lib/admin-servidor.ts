/**
 * Lo que comparten los endpoints de administración.
 *
 * Aquí vive el Admin SDK y la decisión de quién es super admin. Solo se
 * importa desde `pages/api/**`, nunca desde un componente: si entrara en el
 * bundle del navegador, la clave de la cuenta de servicio iría con él.
 *
 * POR QUÉ HACE FALTA EL ADMIN SDK
 * -------------------------------
 * El resto del backend verifica los tokens con la API REST de Identity
 * Toolkit, que solo necesita la API key pública. Para administrar eso no
 * alcanza: con un ID token se puede borrar la PROPIA cuenta, no la de otro, y
 * tampoco se pueden enumerar los usuarios. Borrar la cuenta ajena y listar a
 * todos exige credenciales de cuenta de servicio.
 *
 * De paso, el Admin SDK se salta las reglas de Firestore y Storage, que es
 * justo lo que se necesita: `users` tiene `list` denegado y `vaults/{uid}`
 * tiene `delete` denegado a propósito, con el comentario "el borrado de cuenta
 * se hace desde backend". Esto es ese backend.
 *
 * QUIÉN ES SUPER ADMIN
 * --------------------
 * Sale de una variable de entorno, NO de un campo en Firestore. No es una
 * preferencia de estilo: hoy las reglas dejan que un usuario escriba su propio
 * documento `users/{uid}` completo, así que un flag `esAdmin` ahí sería
 * autoasignable desde la consola del navegador. Una variable de entorno solo
 * se cambia desde Vercel.
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

/* ------------------------------------------------------------------ *
 *  Emuladores
 * ------------------------------------------------------------------ */

/**
 * Con los emuladores puestos el Admin SDK no necesita cuenta de servicio:
 * basta el projectId y estas variables, que son las que el propio SDK busca.
 * Se ponen aquí y no en `.env.local` para que no haya que recordarlas.
 *
 * La doble condición es deliberada. En Vercel `NODE_ENV` vale siempre
 * "production", así que este camino no se puede activar en el sitio
 * desplegado ni aunque alguien dejara la variable del emulador puesta por
 * error. Es el mismo razonamiento que en `subscriptions/cancel`.
 */
export function enEmulador(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.NEXT_PUBLIC_USE_EMULATORS === "1"
  );
}

function prepararEmuladores() {
  const host = process.env.NEXT_PUBLIC_EMULATOR_HOST || "127.0.0.1";
  process.env.FIREBASE_AUTH_EMULATOR_HOST ??= `${host}:9099`;
  process.env.FIRESTORE_EMULATOR_HOST ??= `${host}:8080`;
  /* Storage es el que cambia de nombre entre versiones del SDK; se ponen los
     dos que ha usado. */
  process.env.FIREBASE_STORAGE_EMULATOR_HOST ??= `${host}:9199`;
  process.env.STORAGE_EMULATOR_HOST ??= `http://${host}:9199`;
}

/* ------------------------------------------------------------------ *
 *  Credenciales
 * ------------------------------------------------------------------ */

type CuentaDeServicio = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
};

/**
 * La cuenta de servicio, de cualquiera de las tres formas en que se puede
 * guardar. Se admiten las tres porque cada una es la cómoda en un sitio
 * distinto y es fácil equivocarse con el formato:
 *
 *  1. `FIREBASE_SERVICE_ACCOUNT_B64` — el JSON entero en base64. La más
 *     segura de pegar en Vercel: una sola línea, sin comillas ni saltos que
 *     se puedan estropear al copiar.
 *  2. `FIREBASE_SERVICE_ACCOUNT` — el mismo JSON en crudo.
 *  3. El trío `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`,
 *     `FIREBASE_PRIVATE_KEY`.
 *
 * En el trío, los `\n` de la clave privada suelen llegar escapados: Vercel
 * guarda el valor literal, así que `\n` queda como barra y ene en vez de
 * salto de línea y el SDK falla con "Invalid PEM formatted message". De ahí
 * el reemplazo.
 */
function credenciales(): CuentaDeServicio | null {
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
  const crudo = process.env.FIREBASE_SERVICE_ACCOUNT;

  const json = b64
    ? Buffer.from(b64, "base64").toString("utf8")
    : crudo || null;

  if (json) {
    try {
      const o = JSON.parse(json);
      if (o.project_id && o.client_email && o.private_key) {
        return {
          projectId: o.project_id,
          clientEmail: o.client_email,
          privateKey: String(o.private_key).replace(/\\n/g, "\n"),
        };
      }
      console.error(
        "La cuenta de servicio se pudo leer pero le faltan project_id, client_email o private_key."
      );
      return null;
    } catch (err) {
      console.error("La cuenta de servicio no es JSON válido:", err);
      return null;
    }
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (projectId && clientEmail && privateKey) {
    return {
      projectId,
      clientEmail,
      privateKey: privateKey.replace(/\\n/g, "\n"),
    };
  }

  return null;
}

/* ------------------------------------------------------------------ *
 *  La app
 * ------------------------------------------------------------------ */

const NOMBRE_APP = "backupreader-admin";

/**
 * El bucket de Storage.
 *
 * Se reutiliza la variable pública que ya usa el navegador para no tener dos
 * fuentes que puedan discrepar: apuntar el borrado a otro bucket que el de la
 * app significaría borrar nada y reportar éxito.
 */
function nombreDelBucket(): string | undefined {
  return process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || undefined;
}

/**
 * La app de admin, creada una sola vez.
 *
 * Va con nombre propio en vez de la app por defecto porque en Next una misma
 * instancia atiende muchas peticiones y el módulo se reutiliza; sin esto,
 * `initializeApp` reventaría con "app already exists" en la segunda llamada.
 *
 * Devuelve null si no hay credenciales, en vez de lanzar: así el endpoint
 * puede responder un error claro ("admin-sin-configurar") en lugar de un 500
 * sin explicación.
 */
export function appDeAdmin(): App | null {
  const yaEsta = getApps().find((a) => a.name === NOMBRE_APP);
  if (yaEsta) return yaEsta;

  if (enEmulador()) {
    prepararEmuladores();
    const projectId =
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "demo-backupreader";
    return initializeApp(
      { projectId, storageBucket: nombreDelBucket() },
      NOMBRE_APP
    );
  }

  const cuenta = credenciales();
  if (!cuenta) {
    console.error(
      "Admin SDK sin configurar: falta FIREBASE_SERVICE_ACCOUNT_B64 (o FIREBASE_SERVICE_ACCOUNT, o el trío FIREBASE_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY)."
    );
    return null;
  }

  return initializeApp(
    {
      credential: cert(cuenta),
      projectId: cuenta.projectId,
      storageBucket: nombreDelBucket(),
    },
    NOMBRE_APP
  );
}

export const authAdmin = () => getAuth(appDeAdmin()!);
export const dbAdmin = () => getFirestore(appDeAdmin()!);
export const bucketAdmin = () => getStorage(appDeAdmin()!).bucket();

/* ------------------------------------------------------------------ *
 *  Quién es super admin
 * ------------------------------------------------------------------ */

/* La decisión vive en `admin-permisos`, que no importa nada y por eso se
   puede probar sin credenciales ni SDK. Se re-exporta desde aquí para que los
   endpoints sigan teniendo una sola puerta de entrada. */
export { esSuperAdmin } from "./admin-permisos";

/* ------------------------------------------------------------------ *
 *  La puerta de los endpoints
 * ------------------------------------------------------------------ */

export type QuienLlama = { uid: string; email: string };

/**
 * Deja pasar solo a un super admin y devuelve quién es; si no, ya ha
 * respondido al cliente y devuelve null.
 *
 * Detalles que no son adorno:
 *
 * - `checkRevoked: true`. Un ID token vive una hora. Sin esta comprobación, el
 *   token de un admin al que se le acaba de retirar el acceso —o cuya sesión
 *   se revocó porque se le filtró— seguiría borrando usuarios hasta que
 *   caducara. Cuesta una consulta extra, y estas llamadas son pocas y graves.
 *
 * - El correo sale del token verificado, no del cuerpo de la petición.
 *
 * - Un 403 responde lo mismo esté o no el usuario en la lista: no hay por qué
 *   confirmarle a quien prueba suerte que existe un panel de administración.
 */
export async function soloSuperAdmin(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<QuienLlama | null> {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ ok: false, error: "method-not-allowed" });
    return null;
  }

  if (!appDeAdmin()) {
    res.status(500).json({ ok: false, error: "admin-sin-configurar" });
    return null;
  }

  const { idToken } = req.body ?? {};
  if (typeof idToken !== "string" || !idToken) {
    res.status(401).json({ ok: false, error: "sin-token" });
    return null;
  }

  let uid = "";
  let email = "";
  try {
    const token = await authAdmin().verifyIdToken(idToken, true);
    uid = token.uid;
    email = token.email ?? "";
  } catch (err) {
    console.warn("Token rechazado en un endpoint de administración:", err);
    res.status(401).json({ ok: false, error: "token-invalido" });
    return null;
  }

  if (!esSuperAdmin(uid, email)) {
    console.warn(
      `Intento de usar administración sin permiso: uid=${uid} correo=${email}`
    );
    res.status(403).json({ ok: false, error: "sin-permiso" });
    return null;
  }

  return { uid, email };
}

/* ------------------------------------------------------------------ *
 *  Auditoría
 * ------------------------------------------------------------------ */

/**
 * Deja constancia de lo que hizo un admin.
 *
 * Se guarda en `adminAudit`, una colección que NO aparece en
 * `firestore.rules`, así que el cierre por defecto la deja sin lectura ni
 * escritura desde el navegador. El Admin SDK se salta las reglas, de modo que
 * esto solo se escribe desde aquí y solo se lee desde la consola de Firebase.
 *
 * Un borrado de cuenta es irreversible y no deja rastro en ningún otro sitio:
 * si mañana falta un usuario, esto es lo único que dice quién lo borró y
 * cuándo. Si la escritura falla no se interrumpe la operación —no tiene
 * sentido abortar un borrado a medias por no poder anotarlo—, pero se queda
 * en el log del servidor.
 */
export async function anotarEnAuditoria(
  accion: string,
  datos: Record<string, unknown>
): Promise<void> {
  try {
    await dbAdmin().collection("adminAudit").add({
      accion,
      cuando: new Date().toISOString(),
      ...datos,
    });
  } catch (err) {
    console.error("No se pudo anotar en la auditoría:", accion, datos, err);
  }
}
