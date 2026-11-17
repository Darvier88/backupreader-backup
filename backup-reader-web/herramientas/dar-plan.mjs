#!/usr/bin/env node
/**
 * dar-plan — regala un plan a mano: a una cuenta por correo, o a las cuentas
 * creadas en un año que hoy no tienen acceso.
 *
 * POR QUÉ
 * -------
 * Hay cuentas que se quedaron sin plan (null) o con el plan vencido aunque se
 * dieron de alta gratis con un código de descuento. Esto les pone el plan del
 * precio que digas, sin fecha de fin, y las marca con `user.planManual: true`
 * para que la sincronización con Stripe (webhook, Mi cuenta, sincronizar-
 * planes) no se lo vuelva a quitar. Si un día contratan de verdad y tienen
 * una suscripción activa, manda Stripe y la marca desaparece.
 *
 * A QUIÉN
 * -------
 *   --email correo@x.com   Esa cuenta, tenga lo que tenga.
 *   --creados 2026         Cuentas creadas ese año (fecha de alta de
 *                          Firebase Auth) SIN acceso: plan null, o plan con
 *                          fecha de fin ya pasada. Las que tienen un plan
 *                          vigente no se tocan.
 *
 * QUÉ PLAN
 * --------
 *   --precio 2.99          (por defecto) El documento de `plans` cuyo
 *                          plan.price es ese. Si no hay uno exacto, se para y
 *                          enseña los que hay.
 *
 * ANTES
 *   gcloud auth application-default login
 *   gcloud auth application-default set-quota-project backup-reader
 *
 * USO
 *   node herramientas/dar-plan.mjs --email tata.garcia9114@gmail.com        Informe
 *   node herramientas/dar-plan.mjs --email tata.garcia9114@gmail.com --si   Aplica
 *   node herramientas/dar-plan.mjs --creados 2026                           Informe
 *   node herramientas/dar-plan.mjs --creados 2026 --si                      Aplica
 */

import { initializeApp, applicationDefault, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

const EN_EMULADOR = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const PROYECTO =
  process.env.GOOGLE_CLOUD_PROJECT || (EN_EMULADOR ? "demo-backupreader" : "backup-reader");

const arg = (nombre) => {
  const i = process.argv.indexOf(nombre);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const aplicar = process.argv.includes("--si");
const correoPedido = (arg("--email") || "").trim().toLowerCase();
const anio = Number(arg("--creados")) || 0;
const precio = Number(arg("--precio") ?? 2.99);

if (!correoPedido && !anio) {
  console.error("Di a quién: --email correo@x.com  o  --creados 2026");
  process.exit(1);
}

if (!getApps().length) {
  initializeApp(
    EN_EMULADOR ? { projectId: PROYECTO } : { credential: applicationDefault(), projectId: PROYECTO }
  );
}
const db = getFirestore();
const auth = getAuth();
const fecha = (ms) => (ms ? new Date(ms).toISOString().slice(0, 10) : "—");

/** El plan con ese precio. Exactamente uno, o se para. */
async function planDelPrecio() {
  const snap = await db.collection("plans").get();
  const todos = snap.docs.map((d) => ({ id: d.id, ...(d.data()?.plan ?? {}) }));
  const con = todos.filter((p) => Number(p.price) === precio);
  if (con.length !== 1) {
    console.error(`No hay exactamente un plan con price ${precio}. Los que hay:`);
    for (const p of todos) console.error(`  ${p.id}  price=${p.price}  name=${p.name ?? ""}`);
    process.exit(1);
  }
  return con[0];
}

/** uid -> fecha de alta (ms), de Firebase Auth. */
async function altas() {
  const mapa = new Map();
  let token;
  do {
    const r = await auth.listUsers(1000, token);
    for (const u of r.users) mapa.set(u.uid, Date.parse(u.metadata.creationTime));
    token = r.pageToken;
  } while (token);
  return mapa;
}

async function principal() {
  console.log(`Proyecto: ${PROYECTO}${EN_EMULADOR ? "  (EMULADOR)" : ""}`);
  console.log(aplicar ? "Modo:     APLICAR\n" : "Modo:     informe (no se toca nada)\n");

  const plan = await planDelPrecio();
  console.log(`Plan: ${plan.id}  (${plan.name ?? ""} · ${plan.price} ${plan.currency ?? ""})\n`);

  const ahora = Date.now();
  const usuarios = (await db.collection("users").get()).docs.map((d) => ({ uid: d.id, ...(d.data()?.user ?? {}) }));
  let elegidos = [];

  if (correoPedido) {
    elegidos = usuarios.filter((u) => (u.email || "").trim().toLowerCase() === correoPedido);
    if (elegidos.length === 0) {
      console.error(`No hay ninguna cuenta con el correo ${correoPedido}.`);
      process.exit(1);
    }
  } else {
    const alta = await altas();
    const desde = Date.UTC(anio, 0, 1);
    const hasta = Date.UTC(anio + 1, 0, 1);
    elegidos = usuarios.filter((u) => {
      const t = alta.get(u.uid);
      if (!t || t < desde || t >= hasta) return false;
      const sinAcceso = !u.plan || (u.planCancelAt && u.planCancelAt <= ahora);
      return sinAcceso;
    });
  }

  const yaEstan = elegidos.filter((u) => u.plan === plan.id && !u.planCancelAt && u.planManual);
  const cambian = elegidos.filter((u) => !yaEstan.includes(u));

  console.log(`CAMBIAN (${cambian.length}):`);
  for (const u of cambian) {
    console.log(`  ${u.email || "(sin correo)"}  uid=${u.uid}  antes: plan=${u.plan ?? "null"} fin=${fecha(u.planCancelAt)}`);
  }
  if (yaEstan.length) console.log(`\nYa tenían ese plan regalado: ${yaEstan.length}`);

  if (!aplicar) {
    console.log("\nNo se ha tocado nada. Para aplicarlo: --si");
    return;
  }
  for (const u of cambian) {
    await db.collection("users").doc(u.uid).update({
      "user.plan": plan.id,
      "user.planCancelAt": null,
      "user.planManual": true,
    });
  }
  console.log(`\nHecho: ${cambian.length} cuentas con el plan ${plan.id}.`);
}

principal().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
