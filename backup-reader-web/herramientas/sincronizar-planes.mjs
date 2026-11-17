#!/usr/bin/env node
/**
 * sincronizar-planes — pone el plan de TODOS los usuarios al día con Stripe,
 * una sola vez, al pasar a la configuración nueva (plan sacado de Stripe por
 * el webhook y subscriptions/sync).
 *
 * Después de esto no hace falta volver a correrlo: el webhook mantiene cada
 * cuenta al día. Se puede repetir sin miedo; solo escribe lo que cambia.
 *
 * QUÉ HACE
 * --------
 * Para cada usuario con cliente en Stripe, decide plan y fecha de fin con la
 * MISMA regla que la web (herramientas/estado-del-plan.mjs) y, con --si,
 * escribe `user.plan` y `user.planCancelAt`.
 *
 * Los que tienen `plan` en Firestore pero ningún cliente en Stripe (planes
 * puestos a mano, marcas como "eliminar073124") NO se tocan: salen en una
 * lista aparte para que decidas tú. Ojo: hoy cualquier valor en `plan` da
 * acceso.
 *
 * CÓMO EMPAREJA cliente de Stripe y usuario
 * -----------------------------------------
 * Por `metadata.firebaseUid` del cliente. Si no lo tiene, por correo, y solo
 * si el correo cae en exactamente UN usuario (como etiquetar-clientes-stripe).
 * Si cae en varios, sale como ambiguo y no se toca.
 *
 * ANTES
 * -----
 *   gcloud auth application-default login
 *   gcloud auth application-default set-quota-project backup-reader
 *   export STRIPE_SECRET_KEY=sk_...        (PowerShell: $env:STRIPE_SECRET_KEY="sk_...")
 *
 * USO
 *   node herramientas/sincronizar-planes.mjs          Informe, no toca nada
 *   node herramientas/sincronizar-planes.mjs --si     Escribe los cambios
 *   ... --csv                                         Vuelca las listas en CSV
 */

import { initializeApp, applicationDefault, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import Stripe from "stripe";
import { estadoDelPlan } from "./estado-del-plan.mjs";

const EN_EMULADOR = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const PROYECTO =
  process.env.GOOGLE_CLOUD_PROJECT || (EN_EMULADOR ? "demo-backupreader" : "backup-reader");
const CLAVE = process.env.STRIPE_SECRET_KEY;

if (!CLAVE) {
  console.error("Falta STRIPE_SECRET_KEY en el entorno.");
  process.exit(1);
}

const aplicar = process.argv.includes("--si");
const csv = process.argv.includes("--csv");
const modo = CLAVE.startsWith("sk_live") ? "PRODUCCIÓN (live)" : "prueba (test)";

if (!getApps().length) {
  initializeApp(
    EN_EMULADOR ? { projectId: PROYECTO } : { credential: applicationDefault(), projectId: PROYECTO }
  );
}
const db = getFirestore();
const stripe = new Stripe(CLAVE, { apiVersion: "2022-11-15" });

const normalizar = (c) => (c || "").trim().toLowerCase();
const fecha = (ms) => (ms ? new Date(ms).toISOString().slice(0, 16).replace("T", " ") : "—");

async function paginar(listar) {
  const salida = [];
  let starting_after;
  for (;;) {
    const p = await listar({ limit: 100, ...(starting_after ? { starting_after } : {}) });
    salida.push(...p.data);
    if (!p.has_more) break;
    starting_after = p.data[p.data.length - 1].id;
  }
  return salida;
}

async function principal() {
  console.log(`Proyecto: ${PROYECTO}${EN_EMULADOR ? "  (EMULADOR)" : ""}`);
  console.log(`Stripe:   ${modo}`);
  console.log(aplicar ? "Modo:     APLICAR\n" : "Modo:     informe (no se toca nada)\n");

  /* Usuarios de Firestore. */
  const usuarios = new Map(); // uid -> { email, plan, planCancelAt }
  const porCorreo = new Map(); // correo -> [uid]
  for (const doc of (await db.collection("users").get()).docs) {
    const u = doc.data()?.user ?? {};
    usuarios.set(doc.id, { email: u.email ?? "", plan: u.plan ?? null, planCancelAt: u.planCancelAt ?? null, planManual: Boolean(u.planManual) });
    const c = normalizar(u.email);
    if (c) porCorreo.set(c, [...(porCorreo.get(c) ?? []), doc.id]);
  }

  /* Clientes de Stripe, agrupados por usuario. */
  const clientesDe = new Map(); // uid -> [customerId]
  const ambiguos = [];
  const huerfanos = [];
  for (const c of await paginar((o) => stripe.customers.list(o))) {
    let uid = c.metadata?.firebaseUid;
    if (!uid) {
      const lista = porCorreo.get(normalizar(c.email)) ?? [];
      if (lista.length === 1) uid = lista[0];
      else if (lista.length > 1) {
        ambiguos.push({ cliente: c.id, email: c.email, uids: lista.join(" ") });
        continue;
      }
    }
    if (!uid || !usuarios.has(uid)) {
      huerfanos.push({ cliente: c.id, email: c.email ?? "" });
      continue;
    }
    clientesDe.set(uid, [...(clientesDe.get(uid) ?? []), c.id]);
  }

  const cambios = [];
  let iguales = 0;
  let soloPendientes = 0;
  let regalados = 0;
  for (const [uid, clientes] of clientesDe) {
    const subs = [];
    for (const id of clientes) {
      subs.push(...(await paginar((o) => stripe.subscriptions.list({ ...o, customer: id, status: "all" }))));
    }
    const e = estadoDelPlan(subs);
    if (e.tipo === "sin-cambios") {
      soloPendientes++;
      continue;
    }
    const u = usuarios.get(uid);
    /* Plan regalado (herramientas/dar-plan): solo lo sustituye una
       suscripción con acceso, igual que en la web. */
    const conAcceso = e.planCancelAt === null || e.planCancelAt > Date.now();
    if (u.planManual && !conAcceso) {
      regalados++;
      continue;
    }
    if (u.plan === e.plan && (u.planCancelAt ?? null) === e.planCancelAt && !u.planManual) {
      iguales++;
      continue;
    }
    cambios.push({ uid, email: u.email, antes: u, despues: e });
  }

  /* Con plan en Firestore pero sin cliente en Stripe. */
  const sinStripe = [...usuarios]
    .filter(([uid, u]) => u.plan && !u.planManual && !clientesDe.has(uid))
    .map(([uid, u]) => ({ uid, email: u.email, plan: u.plan, planCancelAt: u.planCancelAt }));

  console.log(`Usuarios: ${usuarios.size}  ·  con cliente en Stripe: ${clientesDe.size}`);
  console.log(`Ya al día: ${iguales}  ·  solo pagos sin confirmar (no se tocan): ${soloPendientes}  ·  planes regalados que se respetan: ${regalados}\n`);

  console.log(`CAMBIAN (${cambios.length}):`);
  for (const c of cambios) {
    console.log(
      `  ${c.email || c.uid}\n    antes:   plan=${c.antes.plan ?? "null"}  fin=${fecha(c.antes.planCancelAt)}\n    después: plan=${c.despues.plan}  fin=${fecha(c.despues.planCancelAt)}`
    );
  }

  console.log(`\nCON PLAN Y SIN STRIPE — no se tocan, decide tú (${sinStripe.length}):`);
  for (const u of sinStripe) console.log(`  ${u.email || "(sin correo)"}  uid=${u.uid}  plan=${u.plan}  fin=${fecha(u.planCancelAt)}`);

  if (ambiguos.length) {
    console.log(`\nCLIENTES DE STRIPE CON CORREO REPETIDO EN FIRESTORE — no se tocan (${ambiguos.length}):`);
    for (const a of ambiguos) console.log(`  ${a.cliente}  ${a.email}  uids: ${a.uids}`);
  }
  if (huerfanos.length) console.log(`\nClientes de Stripe sin usuario en Firestore: ${huerfanos.length} (no se tocan)`);

  if (csv) {
    const fs = await import("fs");
    const linea = (xs) => xs.map((x) => `"${String(x ?? "").replace(/"/g, '""')}"`).join(",");
    fs.writeFileSync(
      "planes-cambios.csv",
      [linea(["uid", "email", "plan_antes", "fin_antes", "plan_despues", "fin_despues"]),
        ...cambios.map((c) => linea([c.uid, c.email, c.antes.plan, fecha(c.antes.planCancelAt), c.despues.plan, fecha(c.despues.planCancelAt)]))].join("\n")
    );
    fs.writeFileSync(
      "planes-sin-stripe.csv",
      [linea(["uid", "email", "plan", "fin"]), ...sinStripe.map((u) => linea([u.uid, u.email, u.plan, fecha(u.planCancelAt)]))].join("\n")
    );
    console.log("\nEscritos planes-cambios.csv y planes-sin-stripe.csv");
  }

  if (!aplicar) {
    console.log("\nNo se ha tocado nada. Para escribir los cambios: --si");
    return;
  }
  for (const c of cambios) {
    await db.collection("users").doc(c.uid).update({
      "user.plan": c.despues.plan,
      "user.planCancelAt": c.despues.planCancelAt,
      "user.planManual": FieldValue.delete(),
    });
  }
  console.log(`\nEscritos ${cambios.length} usuarios.`);
}

principal().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
