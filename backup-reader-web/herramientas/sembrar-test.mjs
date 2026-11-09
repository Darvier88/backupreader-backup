#!/usr/bin/env node
/**
 * sembrar-test — prepara cuentas de prueba para reproducir los dos escenarios
 * que importan ahora mismo:
 *
 *   1) Una cuenta recién creada, sin nada.
 *   2) Una cuenta como las de antes del cifrado: con chats en texto plano.
 *
 * En los dos casos se le pone un plan para que NO pase por /plans, que es lo
 * que pediste: así el muro de pago no estorba mientras se investiga la subida.
 *
 * Por qué el usuario se crea a mano y no aquí: crear cuentas pasa por la API
 * de Auth, que con credenciales de usuario de gcloud devuelve 403 por el tema
 * del quota project. Firestore y Storage sí funcionan, así que el script hace
 * todo lo demás.
 *
 *   gcloud auth application-default login
 *   gcloud auth application-default set-quota-project backup-reader
 *
 * PASO PREVIO, una vez por usuario:
 *   Consola de Firebase -> Authentication -> "Agregar usuario"
 *   Apunta el correo, la contraseña y el UID que te dé.
 *
 * Después:
 *   node herramientas/sembrar-test.mjs nuevo  <uid> --email prueba1@ejemplo.com
 *   node herramientas/sembrar-test.mjs v1     <uid> --email prueba2@ejemplo.com
 *   node herramientas/sembrar-test.mjs estado <uid>
 *   node herramientas/sembrar-test.mjs limpiar <uid> --si
 */

import { initializeApp, applicationDefault, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

import { FOTO_JPG_B64, AUDIO_MP3_B64 } from "./datos.js";

const PROYECTO = process.env.GOOGLE_CLOUD_PROJECT || "backup-reader";
const BUCKET = process.env.BR_BUCKET || `${PROYECTO}.appspot.com`;

/* Plan "Personal". Solo hace falta que el campo NO esté vacío: el control de
   acceso es `user.plan || isWithinTrial(...)` y no comprueba que exista. */
const PLAN_POR_DEFECTO = "NrcM81oeU0KMb6RYduBw";

if (!getApps().length) {
  initializeApp({
    credential: applicationDefault(),
    projectId: PROYECTO,
    storageBucket: BUCKET,
  });
}

const db = getFirestore();
const bucket = getStorage().bucket();

/**
 * Texto de chat en el formato que exporta WhatsApp en iOS, que es el que
 * parsea la app.
 *
 * Ojo al audio: el texto lo nombra `.opus` mientras que el archivo real es
 * `.mp3`. No es un descuido, es exactamente lo que dejaba la Cloud Function
 * `unzip`, que convertía el audio y no tocaba el texto. Sembrarlo así es lo
 * que hace que esta cuenta sirva para probar de verdad.
 */
const textoChat = (nombre) => `[12/01/2024, 10:15:03] ${nombre}: Hola, ¿viste lo que te mandé?
[12/01/2024, 10:15:30] Yo: Todavía no, dame un segundo
[12/01/2024, 10:16:01] ${nombre}: IMG-20240112-WA0003.jpg (archivo adjunto)
[12/01/2024, 10:16:20] Yo: Ah, muy bueno
[12/01/2024, 10:17:12] ${nombre}: AUDIO-20240112-WA0004.opus (archivo adjunto)
[12/01/2024, 10:18:00] Yo: Te escucho luego, estoy en el bus
[12/01/2024, 10:18:44] ${nombre}: Dale, un abrazo
`;

const aviso = (texto) => console.log(texto);

/** Documento de usuario con plan, para saltarse /plans. */
async function prepararUsuario(uid, email, plan) {
  await db.doc(`users/${uid}`).set(
    {
      user: {
        uid,
        email: email ?? null,
        displayName: "Cuenta de prueba",
        photoURL: null,
        plan,
      },
    },
    { merge: true }
  );
  aviso(`users/${uid} listo, con plan ${plan} (no pasará por /plans).`);
}

/** Sube una carpeta de chat v1, tal como la dejaba la Cloud Function. */
async function sembrarChatV1(uid, nombreChat) {
  const base = `backups/${uid}/whatsapp/${nombreChat}`;
  const piezas = [
    ["_chat.txt", Buffer.from(textoChat(nombreChat.replace(/^WhatsApp Chat - /, "")), "utf8"), "text/plain; charset=utf-8"],
    ["IMG-20240112-WA0003.jpg", Buffer.from(FOTO_JPG_B64, "base64"), "image/jpeg"],
    ["AUDIO-20240112-WA0004.mp3", Buffer.from(AUDIO_MP3_B64, "base64"), "audio/mpeg"],
  ];

  for (const [nombre, datos, tipo] of piezas) {
    await bucket.file(`${base}/${nombre}`).save(datos, { contentType: tipo, resumable: false });
    aviso(`  subido ${nombre} (${datos.length} bytes, ${tipo})`);
  }
  aviso(`Carpeta v1 creada en ${base}`);
}

// --- Órdenes ---

async function nuevo(uid, email, plan) {
  await prepararUsuario(uid, email, plan);
  aviso(
    `\nCuenta nueva lista. Al entrar:\n` +
    `  - va directa al dashboard (tiene plan)\n` +
    `  - no tiene bóveda, así que debería pedirle activar el cifrado\n` +
    `  - la lista de chats estará vacía`
  );
}

async function v1(uid, email, plan, nombre, cuantos) {
  await prepararUsuario(uid, email, plan);
  for (let i = 0; i < cuantos; i++) {
    const n = cuantos === 1 ? nombre : `${nombre} ${i + 1}`;
    await sembrarChatV1(uid, n);
  }
  aviso(
    `\nCuenta "de la versión anterior" lista. Al entrar:\n` +
    `  - va directa al dashboard (tiene plan)\n` +
    `  - verá ${cuantos} chat(s) en texto plano y podrá leerlos SIN bóveda\n` +
    `  - no tiene bóveda, así que no podrá subir nada nuevo\n` +
    `  - el audio del chat se nombra .opus y el archivo es .mp3, que es el\n` +
    `    caso real que hay que comprobar al migrarlo`
  );
}

async function estado(uid) {
  const u = await db.doc(`users/${uid}`).get();
  const v = await db.doc(`vaults/${uid}`).get();
  const [archivos] = await bucket.getFiles({ prefix: `backups/${uid}/` });
  const backupsDocs = await db.collection(`vaults/${uid}/backups`).get();

  const v1Archivos = archivos.filter((a) =>
    ["whatsapp", "instagram", "other"].includes(a.name.split("/")[2])
  );

  console.log(`\nuid            ${uid}`);
  console.log(`users/         ${u.exists ? "existe" : "NO existe"}`);
  console.log(`plan           ${u.data()?.user?.plan ?? "(ninguno)"}`);
  console.log(`vaults/        ${v.exists ? "existe (bóveda creada)" : "NO existe (sin bóveda)"}`);
  console.log(`archivos v1    ${v1Archivos.length}`);
  console.log(`backups v2     ${backupsDocs.size} documento(s)`);
  console.log(`objetos total  ${archivos.length}`);

  const puedeEntrar = Boolean(u.data()?.user?.plan);
  const puedeSubir = v.exists;
  console.log(`\n→ entra al dashboard: ${puedeEntrar ? "SÍ" : "depende de la prueba"}`);
  console.log(`→ puede subir chats:  ${puedeSubir ? "sí, si desbloquea la bóveda" : "NO (sin bóveda)"}`);
}

/** Borra TODO lo de este uid. Solo para cuentas de prueba. */
async function limpiar(uid, confirmado) {
  const [archivos] = await bucket.getFiles({ prefix: `backups/${uid}/` });
  const backupsDocs = await db.collection(`vaults/${uid}/backups`).get();

  if (!confirmado) {
    console.log(
      `Esto borraría, del uid ${uid}:\n` +
      `  ${archivos.length} objeto(s) de Storage bajo backups/${uid}/\n` +
      `  ${backupsDocs.size} documento(s) en vaults/${uid}/backups\n` +
      `  el documento vaults/${uid}\n` +
      `  el documento users/${uid}\n\n` +
      `La cuenta de Auth NO se toca: bórrala desde la consola.\n` +
      `Si es lo que quieres, repite el comando añadiendo --si`
    );
    return;
  }

  for (const a of archivos) await a.delete().catch(() => {});
  for (const d of backupsDocs.docs) await d.ref.delete();
  await db.doc(`vaults/${uid}`).delete();
  await db.doc(`users/${uid}`).delete();
  console.log(`Limpiado el uid ${uid}. Borra la cuenta de Auth desde la consola.`);
}

// ---------------------------------------------------------------------------

const AYUDA = `
sembrar-test — cuentas de prueba para el problema de la subida

  PASO PREVIO (una vez por usuario):
    Consola de Firebase -> Authentication -> "Agregar usuario"
    Apunta correo, contraseña y UID.

  nuevo   <uid> [--email X] [--plan ID]     Cuenta nueva, con plan, sin chats
  v1      <uid> [--email X] [--plan ID]     Cuenta con chats SIN cifrar
                [--nombre "WhatsApp Chat - Ana"] [--chats N]
  estado  <uid>                             Qué tiene ahora mismo
  limpiar <uid> [--si]                      Borra lo sembrado (no toca Auth)

  Con --plan se puede poner cualquier texto: el control de acceso solo mira
  que el campo no esté vacío. Por defecto usa el plan Personal real.
`;

const [orden, ...args] = process.argv.slice(2);
const bandera = (n) => args.includes(n);
const valor = (n, pordefecto) => {
  const i = args.indexOf(n);
  return i >= 0 && args[i + 1] ? args[i + 1] : pordefecto;
};
const sueltos = args.filter(
  (a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--"))
);

const uid = sueltos[0];
const plan = valor("--plan", PLAN_POR_DEFECTO);
const email = valor("--email", undefined);

try {
  if (!orden || orden === "ayuda") {
    console.log(AYUDA);
  } else if (!uid) {
    console.log("Falta el uid.\n" + AYUDA);
    process.exitCode = 1;
  } else {
    switch (orden) {
      case "nuevo":
        await nuevo(uid, email, plan);
        break;
      case "v1":
        await v1(
          uid,
          email,
          plan,
          valor("--nombre", "WhatsApp Chat - Ana Pérez"),
          Number(valor("--chats", "1")) || 1
        );
        break;
      case "estado":
        await estado(uid);
        break;
      case "limpiar":
        await limpiar(uid, bandera("--si"));
        break;
      default:
        console.log(AYUDA);
    }
  }
} catch (e) {
  console.error("\nError:", e.message);
  if (String(e.message).includes("Could not load the default credentials")) {
    console.error("Falta autenticarse:  gcloud auth application-default login");
  }
  process.exitCode = 1;
}
