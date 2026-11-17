#!/usr/bin/env node
/**
 * revisar-renovaciones — qué pasó en Stripe con las cuentas que se quedaron
 * sin plan. NO TOCA NADA: solo lee Firestore y Stripe y lo cuenta.
 *
 * POR QUÉ
 * -------
 * Hay cuentas que se dieron de alta con BACKPUP50 (100% de descuento) y al
 * renovar se quedaron sin plan. Antes de arreglar nada hay que saber la
 * causa, porque cada una se arregla en un sitio distinto:
 *
 *  - Stripe dice que la suscripción está ACTIVA pero Firestore no da acceso
 *    → el fallo es de la web; lo arregla `sincronizar-planes --si`.
 *  - Stripe la CANCELÓ por impago → el cupón se acabó (duración «once» o
 *    «repeating») y el cobro del precio completo falló. Se arregla en Stripe.
 *  - La canceló el usuario → no hay nada roto.
 *  - No hay cliente en Stripe → la web no llegó a crear la suscripción.
 *
 * A QUIÉN
 *   --email correo@x.com   Una cuenta.
 *   --creados 2026         Las creadas ese año (alta en Firebase Auth) que
 *                          hoy NO tienen acceso (plan null o vencido).
 *   (sin nada)             Todas las cuentas sin acceso.
 *
 * ANTES
 *   gcloud auth application-default login
 *   gcloud auth application-default set-quota-project backup-reader
 *   export STRIPE_SECRET_KEY=sk_live_...   (PowerShell: $env:STRIPE_SECRET_KEY="sk_live_...")
 *
 * USO
 *   node herramientas/revisar-renovaciones.mjs --email tata.garcia9114@gmail.com
 *   node herramientas/revisar-renovaciones.mjs --creados 2026
 *   ... --csv     También lo escribe en renovaciones.csv
 */

import { initializeApp, applicationDefault, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import Stripe from "stripe";

const EN_EMULADOR = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const PROYECTO =
  process.env.GOOGLE_CLOUD_PROJECT || (EN_EMULADOR ? "demo-backupreader" : "backup-reader");
const CLAVE = process.env.STRIPE_SECRET_KEY;
if (!CLAVE) {
  console.error("Falta STRIPE_SECRET_KEY en el entorno.");
  process.exit(1);
}

const arg = (n) => {
  const i = process.argv.indexOf(n);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const correoPedido = (arg("--email") || "").trim().toLowerCase();
const anio = Number(arg("--creados")) || 0;
const csv = process.argv.includes("--csv");

if (!getApps().length) {
  initializeApp(
    EN_EMULADOR ? { projectId: PROYECTO } : { credential: applicationDefault(), projectId: PROYECTO }
  );
}
const db = getFirestore();
const auth = getAuth();
const stripe = new Stripe(CLAVE, { apiVersion: "2022-11-15" });

const dia = (s) => (s ? new Date(s * (s < 1e12 ? 1000 : 1)).toISOString().slice(0, 10) : "—");
const normalizar = (c) => (c || "").trim().toLowerCase();

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

/** Clientes de Stripe de una cuenta: por uid en metadata y por correo. */
async function clientes(uid, correo) {
  const vistos = new Map();
  try {
    const r = await stripe.customers.search({ query: `metadata['firebaseUid']:'${uid}'`, limit: 20 });
    for (const c of r.data) vistos.set(c.id, c);
  } catch {
    /* búsqueda no disponible: queda el correo */
  }
  if (correo) {
    const r = await stripe.customers.list({ email: correo, limit: 20 });
    for (const c of r.data) vistos.set(c.id, c);
  }
  return [...vistos.values()];
}

/** La explicación corta de una suscripción. */
function veredicto(s, conAccesoEnFirestore) {
  const motivo = s.cancellation_details?.reason;
  if (["active", "trialing"].includes(s.status)) {
    return conAccesoEnFirestore
      ? "OK en Stripe y en la web."
      : "ACTIVA en Stripe pero la web no da acceso → fallo de la web: lo arregla sincronizar-planes --si.";
  }
  if (s.status === "past_due") return "Cobro fallido, Stripe sigue reintentando.";
  if (s.status === "unpaid") return "Impagada: Stripe dejó de reintentar.";
  if (s.status === "canceled") {
    if (motivo === "payment_failed" || motivo === "payment_disputed")
      return "Cancelada por IMPAGO: el cupón ya no cubría la renovación y el cobro falló.";
    if (motivo === "cancellation_requested") return "Cancelada a petición (usuario o web).";
    return "Cancelada (Stripe no dice el motivo; mira la última factura).";
  }
  if (s.status === "incomplete" || s.status === "incomplete_expired")
    return "El primer pago nunca se confirmó.";
  return s.status;
}

async function principal() {
  console.log(`Proyecto: ${PROYECTO}  ·  Stripe: ${CLAVE.startsWith("sk_live") ? "PRODUCCIÓN" : "prueba"}`);
  console.log("Solo lectura: no se toca nada.\n");

  const ahora = Date.now();
  const usuarios = (await db.collection("users").get()).docs.map((d) => ({ uid: d.id, ...(d.data()?.user ?? {}) }));
  const sinAcceso = (u) => !u.plan || (u.planCancelAt && u.planCancelAt <= ahora);

  let elegidos;
  if (correoPedido) {
    elegidos = usuarios.filter((u) => normalizar(u.email) === correoPedido);
  } else {
    elegidos = usuarios.filter(sinAcceso);
    if (anio) {
      /* La fecha de alta sale del propio documento (`user.creationDate`,
         p. ej. «Sun, 24 Sep 2023 15:58:59 GMT»). Solo si falta en alguno se
         pregunta a Firebase Auth, que con credenciales locales exige un
         proyecto de cuota; si eso falla, se avisa y se sigue sin ellos. */
      const desde = Date.UTC(anio, 0, 1);
      const hasta = Date.UTC(anio + 1, 0, 1);
      const delDoc = (u) => {
        const t = Date.parse(u.creationDate ?? "");
        return Number.isFinite(t) ? t : null;
      };
      let alta = new Map();
      if (elegidos.some((u) => delDoc(u) === null)) {
        try {
          alta = await altas();
        } catch (e) {
          console.warn(
            "Aviso: no se pudo leer Firebase Auth (" + (e?.code ?? e?.message) + "). " +
              "Las cuentas sin creationDate en Firestore se dejan fuera. Para incluirlas:\n" +
              "  gcloud auth application-default set-quota-project backup-reader\n"
          );
        }
      }
      elegidos = elegidos.filter((u) => {
        const t = delDoc(u) ?? alta.get(u.uid);
        return t && t >= desde && t < hasta;
      });
    }
  }
  if (elegidos.length === 0) {
    console.log("No hay cuentas que revisar.");
    return;
  }

  const filas = [];
  const resumen = new Map();

  for (const u of elegidos) {
    console.log(`■ ${u.email || "(sin correo)"}  uid=${u.uid}`);
    console.log(`  Firestore: plan=${u.plan ?? "null"}  fin=${dia(u.planCancelAt)}  → ${sinAcceso(u) ? "SIN acceso" : "con acceso"}`);

    const cs = await clientes(u.uid, u.email);
    if (cs.length === 0) {
      /* Sin plan y sin cliente es lo normal de quien se registró y nunca
         pagó. Solo es raro si Firestore dice que tuvo plan. */
      const v = u.plan
        ? "Tiene plan en Firestore pero ningún cliente en Stripe: revisar a mano."
        : "Nunca contrató (sin cliente en Stripe). Normal.";
      console.log(`  Stripe: ${v}\n`);
      resumen.set(v, (resumen.get(v) ?? 0) + 1);
      filas.push([u.email, u.uid, u.plan, dia(u.planCancelAt), "", "", "", "", "", "", "", v]);
      continue;
    }

    for (const c of cs) {
      const subs = await stripe.subscriptions.list({
        customer: c.id,
        status: "all",
        limit: 20,
        expand: ["data.latest_invoice.payment_intent"],
      });
      if (subs.data.length === 0) console.log(`  Cliente ${c.id}: sin suscripciones.`);
      for (const s of subs.data) {
        const cupon = s.discount?.coupon;
        const duracion = cupon
          ? cupon.duration === "repeating"
            ? `repeating ${cupon.duration_in_months} meses`
            : cupon.duration
          : "—";
        const f = s.latest_invoice;
        const pi = f?.payment_intent;
        const falloCobro = pi?.last_payment_error?.message || f?.last_finalization_error?.message || "";
        const v = veredicto(s, !sinAcceso(u));
        resumen.set(v, (resumen.get(v) ?? 0) + 1);

        console.log(`  Suscripción ${s.id}  [${s.status}]  creada ${dia(s.created)}  periodo hasta ${dia(s.current_period_end)}`);
        if (s.canceled_at) console.log(`    cancelada ${dia(s.canceled_at)}  motivo: ${s.cancellation_details?.reason ?? "—"}  al final del periodo: ${s.cancel_at_period_end}`);
        console.log(`    cupón: ${cupon ? `${cupon.id} ${cupon.percent_off ?? ""}% duración ${duracion}` : "ninguno ahora (puede haberse acabado)"}`);
        if (f) console.log(`    última factura: ${(f.amount_due ?? 0) / 100} ${f.currency ?? ""}  estado ${f.status}  intentos ${f.attempt_count ?? 0}${falloCobro ? `  fallo: ${falloCobro}` : ""}`);
        console.log(`    → ${v}`);
        filas.push([u.email, u.uid, u.plan, dia(u.planCancelAt), s.id, s.status, dia(s.canceled_at), s.cancellation_details?.reason ?? "", cupon?.id ?? "", duracion, f ? `${(f.amount_due ?? 0) / 100} ${f.status}` : "", v]);
      }
    }
    console.log("");
  }

  console.log("RESUMEN");
  for (const [v, n] of [...resumen].sort((a, b) => b[1] - a[1])) console.log(`  ${n} × ${v}`);

  /* El cupón en sí: si dura un mes, ahí está la causa. */
  try {
    const promos = await stripe.promotionCodes.list({ code: "BACKPUP50", limit: 5 });
    for (const p of promos.data) {
      const c = p.coupon;
      console.log(
        `\nCódigo BACKPUP50 → cupón ${c.id}: ${c.percent_off ?? ""}% · duración ${c.duration}${c.duration === "repeating" ? ` (${c.duration_in_months} meses)` : ""} · activo ${p.active}`
      );
      if (c.duration !== "forever")
        console.log("  Ojo: no es «forever». Al acabarse, Stripe cobra el precio completo en la renovación.");
    }
  } catch {
    /* sin permiso para leer códigos: no es grave */
  }

  if (csv) {
    const fs = await import("fs");
    const linea = (xs) => xs.map((x) => `"${String(x ?? "").replace(/"/g, '""')}"`).join(",");
    fs.writeFileSync(
      "renovaciones.csv",
      [linea(["email", "uid", "plan", "fin_firestore", "suscripcion", "estado", "cancelada", "motivo", "cupon", "duracion", "ultima_factura", "veredicto"]), ...filas.map(linea)].join("\n")
    );
    console.log("\nEscrito renovaciones.csv");
  }
}

principal().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
