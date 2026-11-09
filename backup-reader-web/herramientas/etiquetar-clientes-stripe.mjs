#!/usr/bin/env node
/**
 * etiquetar-clientes-stripe — pone el uid de Firebase en los clientes que ya
 * existían en Stripe antes de que se empezara a guardar.
 *
 * POR QUÉ
 * -------
 * La cancelación busca al cliente por `metadata.firebaseUid`. Los que pagaron
 * antes de ese cambio no lo tienen, así que caen al respaldo por correo, que
 * falla en cuanto el correo de Stripe no es el de la cuenta. Esto los deja
 * etiquetados y el respaldo deja de hacer falta para ellos.
 *
 * CÓMO EMPAREJA
 * -------------
 * Por correo, que es lo único que comparten hoy. Cuando un correo de Stripe
 * cae en exactamente UN usuario de Firestore, se etiqueta. Si no cae en
 * ninguno, o cae en varios, NO se inventa nada: sale en el informe para que lo
 * mires a mano. Emparejar mal es peor que no emparejar: significaría dejar que
 * alguien cancele la suscripción de otro.
 *
 * ANTES
 * -----
 *   gcloud auth application-default login
 *   gcloud auth application-default set-quota-project backup-reader
 *
 * Y la clave secreta de Stripe en el entorno:
 *   PowerShell:  $env:STRIPE_SECRET_KEY="sk_..."
 *   bash:        export STRIPE_SECRET_KEY=sk_...
 *
 * USO
 *   node herramientas/etiquetar-clientes-stripe.mjs          Informe, no toca nada
 *   node herramientas/etiquetar-clientes-stripe.mjs --si     Aplica las etiquetas
 *   ... --csv                                                Vuelca los no resueltos
 */

import { initializeApp, applicationDefault, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import Stripe from "stripe";

/* Con FIRESTORE_EMULATOR_HOST puesto, admin habla con el emulador y no pide
   credenciales. Es lo que permite ensayar esto en local antes de soltarlo
   sobre los clientes de verdad. */
const EN_EMULADOR = Boolean(process.env.FIRESTORE_EMULATOR_HOST);

const PROYECTO =
  process.env.GOOGLE_CLOUD_PROJECT || (EN_EMULADOR ? "demo-backupreader" : "backup-reader");
const CLAVE = process.env.STRIPE_SECRET_KEY || process.env.NEXT_PUBLIC_STRIPE_KEYS;

if (!CLAVE) {
  console.error("Falta STRIPE_SECRET_KEY en el entorno.");
  process.exit(1);
}

const aplicar = process.argv.includes("--si");
const csv = process.argv.includes("--csv");

/* Que quede claro contra qué se está trabajando: este script ESCRIBE en
   Stripe, y en producción escribe sobre clientes reales. */
const modo = CLAVE.startsWith("sk_live") ? "PRODUCCIÓN (live)" : "prueba (test)";

if (!getApps().length) {
  initializeApp(
    EN_EMULADOR ? { projectId: PROYECTO } : { credential: applicationDefault(), projectId: PROYECTO }
  );
}
const db = getFirestore();
const stripe = new Stripe(CLAVE, { apiVersion: "2022-11-15" });

const normalizar = (c) => (c || "").trim().toLowerCase();

/** correo -> [uid, ...] de Firestore. Lista, porque puede repetirse. */
async function usuariosPorCorreo() {
  const mapa = new Map();
  const snap = await db.collection("users").get();
  for (const doc of snap.docs) {
    const correo = normalizar(doc.data()?.user?.email);
    if (!correo) continue;
    if (!mapa.has(correo)) mapa.set(correo, []);
    mapa.get(correo).push(doc.id);
  }
  return mapa;
}

/** Todos los clientes de Stripe, paginando de verdad. */
async function todosLosClientes() {
  const salida = [];
  let starting_after;
  for (;;) {
    const pagina = await stripe.customers.list({ limit: 100, ...(starting_after ? { starting_after } : {}) });
    salida.push(...pagina.data);
    if (!pagina.has_more) break;
    starting_after = pagina.data[pagina.data.length - 1].id;
  }
  return salida;
}

async function principal() {
  console.log(`Proyecto: ${PROYECTO}${EN_EMULADOR ? "  (EMULADOR)" : ""}`);
  console.log(`Stripe:   ${modo}`);
  console.log(aplicar ? "Modo:     APLICAR\n" : "Modo:     informe (no se toca nada)\n");

  const porCorreo = await usuariosPorCorreo();
  const clientes = await todosLosClientes();

  const yaEstaban = [];
  const emparejados = [];
  const sinCorreo = [];
  const sinUsuario = [];
  const ambiguos = [];

  for (const c of clientes) {
    if (c.metadata?.firebaseUid) {
      yaEstaban.push(c);
      continue;
    }
    const correo = normalizar(c.email);
    if (!correo) {
      sinCorreo.push(c);
      continue;
    }
    const uids = porCorreo.get(correo);
    if (!uids || uids.length === 0) {
      sinUsuario.push(c);
      continue;
    }
    if (uids.length > 1) {
      ambiguos.push({ cliente: c, uids });
      continue;
    }
    emparejados.push({ cliente: c, uid: uids[0] });
  }

  let escritos = 0;
  if (aplicar) {
    for (const { cliente, uid } of emparejados) {
      try {
        await stripe.customers.update(cliente.id, { metadata: { firebaseUid: uid } });
        escritos++;
      } catch (err) {
        console.error(`  fallo en ${cliente.id}:`, err.message);
      }
    }
  }

  console.log(`clientes en Stripe       ${clientes.length}`);
  console.log(`ya etiquetados           ${yaEstaban.length}`);
  console.log(
    `se pueden etiquetar      ${emparejados.length}` + (aplicar ? `  -> escritos ${escritos}` : "")
  );
  console.log(`sin correo en Stripe     ${sinCorreo.length}`);
  console.log(`correo sin usuario       ${sinUsuario.length}`);
  console.log(`correo en varios users   ${ambiguos.length}`);

  const pendientes = sinCorreo.length + sinUsuario.length + ambiguos.length;
  if (pendientes > 0) {
    console.log(
      `\n${pendientes} cliente(s) no se pueden resolver automáticamente.\n` +
        "Esos siguen dependiendo del respaldo por correo. Pásalos a mano o\n" +
        "déjalos: lo que NO se debe hacer es adivinar a quién pertenecen."
    );
    if (csv) {
      console.log("\nid,email,motivo");
      for (const c of sinCorreo) console.log(`${c.id},,sin-correo`);
      for (const c of sinUsuario) console.log(`${c.id},${c.email},correo-sin-usuario`);
      for (const { cliente, uids } of ambiguos)
        console.log(`${cliente.id},${cliente.email},varios-usuarios:${uids.join("|")}`);
    } else {
      console.log("Añade --csv para volcarlos.");
    }
  }

  if (!aplicar && emparejados.length > 0) {
    console.log(`\nPara escribir las ${emparejados.length} etiquetas, repite con --si`);
  }
}

principal().catch((e) => {
  console.error("\nError:", e.message);
  if (String(e.message).includes("Could not load the default credentials")) {
    console.error("Falta autenticarse:  gcloud auth application-default login");
  }
  process.exitCode = 1;
});
