#!/usr/bin/env node
/**
 * br — herramienta de administración de Backup Reader.
 *
 * Se ejecuta DESDE TU MÁQUINA y se autentica con tu propia sesión de gcloud
 * (Application Default Credentials). No hay archivo de clave que guardar ni
 * que filtrar, y no despliega ningún endpoint: cuando cierras la terminal, no
 * queda nada accesible desde fuera.
 *
 *   gcloud auth application-default login
 *   gcloud config set project backup-reader
 *   node herramientas/br.mjs diagnostico correo@ejemplo.com
 *
 * PRIVACIDAD: esta herramienta no imprime nunca nombres de chats, nombres de
 * archivos ni contenido de mensajes. Los backups cifrados además no se pueden
 * leer desde aquí: sus nombres viven dentro del manifiesto, que solo abre la
 * clave del usuario. Lo que se ve son recuentos, fechas y tamaños.
 */

import { initializeApp, applicationDefault, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

// Debe coincidir con config/trial.ts
const DIAS_DE_PRUEBA = 15;

const PROYECTO = process.env.GOOGLE_CLOUD_PROJECT || "backup-reader";
const BUCKET = process.env.BR_BUCKET || `${PROYECTO}.appspot.com`;

// Carpetas donde la antigua Cloud Function dejaba los backups en texto plano.
const CARPETAS_V1 = ["whatsapp", "instagram", "other"];

if (!getApps().length) {
  initializeApp({
    credential: applicationDefault(),
    projectId: PROYECTO,
    storageBucket: BUCKET,
  });
}

const auth = getAuth();
const db = getFirestore();
const bucket = getStorage().bucket();

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

const dias = (desde) =>
  Math.floor((Date.now() - new Date(desde).getTime()) / 86400000);

const mb = (bytes) => (bytes / 1048576).toFixed(2) + " MB";

const fecha = (d) => (d ? new Date(d).toISOString().slice(0, 16).replace("T", " ") : "—");

/** Acepta un correo o un uid y devuelve el registro de Auth. */
async function buscarUsuario(quien) {
  try {
    return quien.includes("@")
      ? await auth.getUserByEmail(quien)
      : await auth.getUser(quien);
  } catch (e) {
    if (e.code === "auth/user-not-found") return null;
    throw e;
  }
}

/** El documento de Firestore del usuario, que es donde vive el plan. */
async function docUsuario(uid) {
  const snap = await db.doc(`users/${uid}`).get();
  return snap.exists ? snap.data() : null;
}

/**
 * Cuenta lo que tiene el usuario en Storage, sin mirar ningún nombre.
 *
 * Pagina de verdad: `getFiles` sin autoPaginate devuelve como mucho 1000
 * entradas, y el código de la app arrastró ese error durante meses.
 */
async function inventario(uid) {
  const [archivos] = await bucket.getFiles({ prefix: `backups/${uid}/` });
  const v1 = {};
  const v2 = new Set();
  let bytesV1 = 0;
  let bytesV2 = 0;

  for (const a of archivos) {
    const resto = a.name.slice(`backups/${uid}/`.length);
    const primero = resto.split("/")[0];
    const tam = Number(a.metadata.size || 0);
    if (CARPETAS_V1.includes(primero)) {
      v1[primero] = (v1[primero] || 0) + 1;
      bytesV1 += tam;
    } else if (primero) {
      v2.add(primero);
      bytesV2 += tam;
    }
  }
  return { v1, bytesV1, backupsV2: v2.size, bytesV2, objetos: archivos.length };
}

/** Documentos de backups cifrados en Firestore (metadatos, nunca nombres). */
async function backupsCifrados(uid) {
  const snap = await db.collection(`vaults/${uid}/backups`).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ---------------------------------------------------------------------------
// Órdenes
// ---------------------------------------------------------------------------

/**
 * Responde a "¿por qué esta persona no puede subir chats?".
 *
 * Reproduce la misma condición que decide el acceso en LoadingComponent.tsx:
 *     hasAccess = user.plan || isWithinTrial(diasTranscurridos)
 * Sin acceso, la app redirige a /plans y nunca se llega al dashboard, que es
 * donde está el botón de subir.
 */
async function diagnostico(quien) {
  const u = await buscarUsuario(quien);
  if (!u) return console.log(`No existe ningún usuario con «${quien}».`);

  const transcurridos = dias(u.metadata.creationTime);
  const doc = await docUsuario(u.uid);
  const plan = doc?.user?.plan ?? null;
  const enPrueba = transcurridos >= 0 && transcurridos < DIAS_DE_PRUEBA + 1;
  const acceso = Boolean(plan) || enPrueba;

  console.log(`\nUsuario      ${u.email || "(sin correo)"}`);
  console.log(`uid          ${u.uid}`);
  console.log(`Creado       ${fecha(u.metadata.creationTime)}  (hace ${transcurridos} días)`);
  console.log(`Último login ${fecha(u.metadata.lastSignInTime)}`);
  console.log(`Documento    ${doc ? "existe" : "NO EXISTE en users/"}`);
  console.log(`Plan         ${plan ?? "(ninguno)"}`);
  console.log(`En prueba    ${enPrueba ? "sí" : `no (caducó a los ${DIAS_DE_PRUEBA} días)`}`);
  console.log(`\n→ ACCESO AL DASHBOARD: ${acceso ? "SÍ" : "NO"}`);

  if (!acceso) {
    console.log(
      `\n  Por eso no puede subir chats: sin acceso, la app lo manda a /plans\n` +
      `  y nunca llega al dashboard. Para desbloquearlo:\n` +
      `      node herramientas/br.mjs plan ${u.uid} <idDelPlan> --si\n` +
      `  (los ids salen de: node herramientas/br.mjs planes)`
    );
  }

  if (!doc) {
    console.log(
      `\n  Además no tiene documento en users/. La app lo crea al iniciar\n` +
      `  sesión; si falta, algo falló en ese momento.`
    );
  }

  const inv = await inventario(u.uid);
  const cif = await backupsCifrados(u.uid);
  const sinCifrar = Object.values(inv.v1).reduce((a, b) => a + b, 0);
  console.log(`\nAlmacenamiento`);
  console.log(`  Backups cifrados       ${inv.backupsV2}  (${mb(inv.bytesV2)})`);
  console.log(`  Documentos en Firestore ${cif.length}`);
  console.log(`  Archivos en texto plano ${sinCifrar}  (${mb(inv.bytesV1)})`);
  if (sinCifrar) console.log(`    por carpeta: ${JSON.stringify(inv.v1)}`);
  if (cif.length !== inv.backupsV2) {
    console.log(
      `  AVISO: ${cif.length} documentos frente a ${inv.backupsV2} carpetas en Storage.\n` +
      `         Suele significar subidas cortadas a medias (blobs huérfanos).`
    );
  }
}

/**
 * Lista TODOS los usuarios, con su estado de acceso.
 *
 * Dos detalles que importan:
 *
 *  - `listUsers` devuelve como mucho 1000 por página. Aquí se sigue el
 *    pageToken hasta el final; este proyecto ya arrastró un fallo de ese tipo
 *    con `list()` de Storage, que truncaba en silencio.
 *
 *  - Los documentos de Firestore se leen de una sola vez y se indexan por uid,
 *    en lugar de una lectura por usuario. Con 70 cuentas da igual; con 7000,
 *    no.
 *
 * El estado reproduce la condición de LoadingComponent.tsx:
 *     hasAccess = user.plan || isWithinTrial(diasTranscurridos)
 */
async function usuarios(soloBloqueados, comoCsv) {
  const docs = new Map();
  const snap = await db.collection("users").get();
  for (const d of snap.docs) docs.set(d.id, d.data());

  const filas = [];
  let pageToken;
  do {
    const r = await auth.listUsers(1000, pageToken);
    for (const u of r.users) {
      const transcurridos = dias(u.metadata.creationTime);
      const plan = docs.get(u.uid)?.user?.plan ?? null;
      const enPrueba = transcurridos >= 0 && transcurridos < DIAS_DE_PRUEBA + 1;
      filas.push({
        email: u.email || "(sin correo)",
        uid: u.uid,
        creado: u.metadata.creationTime,
        dias: transcurridos,
        ultimoAcceso: u.metadata.lastSignInTime,
        plan,
        tieneDoc: docs.has(u.uid),
        estado: plan ? "plan" : enPrueba ? "prueba" : "BLOQUEADO",
      });
    }
    pageToken = r.pageToken;
  } while (pageToken);

  filas.sort((a, b) => new Date(a.creado) - new Date(b.creado));
  const visibles = soloBloqueados ? filas.filter((f) => f.estado === "BLOQUEADO") : filas;

  if (comoCsv) {
    console.log("email,uid,creado,dias,ultimoAcceso,plan,tieneDoc,estado");
    for (const f of visibles) {
      console.log([f.email, f.uid, f.creado, f.dias, f.ultimoAcceso || "", f.plan || "", f.tieneDoc, f.estado]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
    }
    return;
  }

  console.log("\nestado      días  creado            último acceso     plan            correo");
  console.log("─".repeat(104));
  for (const f of visibles) {
    console.log(
      f.estado.padEnd(11) +
      String(f.dias).padStart(5) + "  " +
      fecha(f.creado).padEnd(17) + " " +
      fecha(f.ultimoAcceso).padEnd(17) + " " +
      String(f.plan ?? "—").slice(0, 14).padEnd(15) + " " +
      f.email + (f.tieneDoc ? "" : "   [sin documento en users/]")
    );
  }

  const cuenta = (e) => filas.filter((f) => f.estado === e).length;
  console.log("─".repeat(104));
  console.log(
    `${filas.length} usuarios · ${cuenta("plan")} con plan · ` +
    `${cuenta("prueba")} en prueba · ${cuenta("BLOQUEADO")} bloqueados` +
    (soloBloqueados ? `  (mostrando solo los bloqueados)` : "")
  );
  const sinDoc = filas.filter((f) => !f.tieneDoc).length;
  if (sinDoc) console.log(`${sinDoc} sin documento en users/: la app lo crea al iniciar sesión, así que algo falló ahí.`);
}

async function usuario(quien) {
  const u = await buscarUsuario(quien);
  if (!u) return console.log(`No existe ningún usuario con «${quien}».`);
  const doc = await docUsuario(u.uid);
  console.log(JSON.stringify({
    uid: u.uid,
    email: u.email,
    creado: u.metadata.creationTime,
    diasDesdeCreacion: dias(u.metadata.creationTime),
    ultimoAcceso: u.metadata.lastSignInTime,
    proveedores: u.providerData.map((p) => p.providerId),
    deshabilitado: u.disabled,
    plan: doc?.user?.plan ?? null,
    tieneDocumento: Boolean(doc),
  }, null, 2));
}

async function backups(uid) {
  const inv = await inventario(uid);
  const cif = await backupsCifrados(uid);
  console.log(`\nObjetos en Storage: ${inv.objetos}`);
  console.log(`Cifrados: ${inv.backupsV2} backups, ${mb(inv.bytesV2)}`);
  console.log(`Texto plano: ${JSON.stringify(inv.v1)}, ${mb(inv.bytesV1)}\n`);
  if (!cif.length) return console.log("Sin documentos de backup en Firestore.");
  console.log("backupId                              creado             piezas   cifrado");
  for (const b of cif.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))) {
    console.log(
      `${b.id.padEnd(37)} ${fecha(b.createdAt).padEnd(18)} ${String(b.pieceCount ?? "?").padStart(6)}   ${mb(b.cipherBytes ?? 0)}`
    );
  }
}

async function planes() {
  const snap = await db.collection("plans").get();
  if (snap.empty) return console.log("La colección plans está vacía.");
  for (const d of snap.docs) {
    const p = d.data().plan || {};
    console.log(`${d.id.padEnd(26)} ${String(p.name ?? "").padEnd(18)} ${p.price ?? "?"} ${p.currency ?? ""}  ${p.storage ?? "?"} GB`);
  }
}

/** Única orden que ESCRIBE. Exige --si para no dispararse por accidente. */
async function plan(uid, valor, confirmado) {
  const quitar = valor === "--quitar";
  if (!confirmado) {
    return console.log(
      `Esto escribiría user.plan = ${quitar ? "null" : valor} en users/${uid}.\n` +
      `Vuelve a ejecutarlo añadiendo --si al final si es lo que quieres.`
    );
  }
  if (!quitar) {
    const p = await db.doc(`plans/${valor}`).get();
    if (!p.exists) return console.log(`No existe plans/${valor}. Mira: br.mjs planes`);
  }
  await db.doc(`users/${uid}`).set({ user: { plan: quitar ? null : valor } }, { merge: true });
  console.log(`Hecho: users/${uid} → user.plan = ${quitar ? "null" : valor}`);
}

/**
 * Crea un usuario de prueba, sin plan.
 *
 * Importante sobre "sin período de prueba": la prueba se calcula desde
 * `creationTime` de Auth, y esa fecha NO se puede fijar al crear un usuario.
 * Cambiarla exige reimportarlo con un hash de contraseña en un formato que
 * Firebase acepte, y eso no lo he podido probar contra tu proyecto, así que
 * no lo incluyo: prefiero no darte código que quizá no funcione justo cuando
 * lo necesites.
 *
 * Para reproducir el bloqueo hay dos caminos que sí funcionan seguro, los dos
 * apoyados en que `isWithinTrial` devuelve false cuando la prueba está
 * apagada (ver config/trial.ts):
 *
 *   En local:        NEXT_PUBLIC_FREE_TRIAL_ENABLED=false npm run dev
 *   En un preview:   la misma variable en el entorno Preview de Vercel
 *
 * Con cualquiera de los dos, esta cuenta recién creada queda bloqueada
 * exactamente igual que la de Luis.
 */
async function crearTest(email, password) {
  const existente = await buscarUsuario(email);
  if (existente) return console.log(`Ya existe: ${existente.uid}`);

  const u = await auth.createUser({ email, password, emailVerified: true });
  await db.doc(`users/${u.uid}`).set({
    user: { uid: u.uid, email, displayName: "Cuenta de prueba", photoURL: null, plan: null },
  });

  console.log(`Creado ${u.uid} (${email}), con documento en users/ y sin plan.`);
  console.log(
    `\nLa cuenta es de hoy, así que AHORA MISMO está dentro de la prueba.\n` +
    `Para que quede bloqueada como la de Luis, arranca con la prueba apagada:\n` +
    `    NEXT_PUBLIC_FREE_TRIAL_ENABLED=false npm run dev\n` +
    `o pon esa variable en el entorno Preview de Vercel.`
  );
}

// ---------------------------------------------------------------------------

const AYUDA = `
br — administración de Backup Reader (solo lectura salvo donde se indica)

  diagnostico <correo|uid>     Por qué alguien no puede subir chats
  usuarios    [--bloqueados] [--csv]   Todos los usuarios y su estado de acceso
  usuario     <correo|uid>     Ficha del usuario en Auth + Firestore
  backups     <uid>            Qué tiene guardado, en recuentos y tamaños
  planes                       Catálogo de planes con sus ids
  plan        <uid> <idPlan|--quitar> [--si]    ESCRIBE: asigna o quita plan
  crear-test  <correo> <contraseña>             ESCRIBE: crea cuenta de prueba

Antes de usarla:
  gcloud auth application-default login
  gcloud config set project backup-reader

No imprime nombres de chats, de archivos ni contenido de mensajes.
`;

const [orden, ...args] = process.argv.slice(2);
const bandera = (n) => args.includes(n);
const valorDe = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const sueltos = args.filter((a) => !a.startsWith("--"));

try {
  switch (orden) {
    case "diagnostico": await diagnostico(sueltos[0]); break;
    case "usuarios":    await usuarios(bandera("--bloqueados"), bandera("--csv")); break;
    case "usuario":     await usuario(sueltos[0]); break;
    case "backups":     await backups(sueltos[0]); break;
    case "planes":      await planes(); break;
    case "plan":        await plan(sueltos[0], sueltos[1] ?? (bandera("--quitar") ? "--quitar" : undefined), bandera("--si")); break;
    case "crear-test":  await crearTest(sueltos[0], sueltos[1]); break;
    default: console.log(AYUDA);
  }
} catch (e) {
  console.error("\nError:", e.message);
  if (String(e.message).includes("Could not load the default credentials")) {
    console.error("Falta autenticarse:  gcloud auth application-default login");
  }
  process.exitCode = 1;
}
