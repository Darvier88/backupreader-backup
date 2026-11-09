#!/usr/bin/env node
/**
 * sembrar-emulador — llena el Firestore del EMULADOR para poder probar.
 *
 * El emulador arranca vacío, así que la colección `plans` no existe y la
 * pantalla de planes sale en blanco: `PlansScreen` busca literalmente un plan
 * de precio 2.99 y no lo encuentra. Esto la siembra.
 *
 * No necesita credenciales ni acceso al Firebase real: habla solo con el
 * emulador, que acepta cualquier proyecto que empiece por `demo-`.
 *
 * ANTES, en otra terminal:
 *   npx firebase emulators:start --only firestore,storage,auth --project demo-backupreader
 *
 * ÓRDENES
 *   planes                        Crea la colección `plans` (los tres planes)
 *   usuario <uid> [correo]        Crea users/{uid} con el plan Personal
 *   plan <uid> <idPlan|--quitar>  Cambia el plan de un usuario
 *   cancelar <uid> [dias]         Pone planCancelAt dentro de N días (por
 *                                 defecto 30). Con un número NEGATIVO lo pone
 *                                 en el pasado, que es el atajo para probar
 *                                 qué pasa cuando el periodo vence.
 *   reactivar <uid>               Quita planCancelAt
 *   estado <uid>                  Qué tiene ahora mismo
 *
 * El uid lo sacas de la UI del emulador, en http://localhost:4000 ->
 * Authentication, después de crear la cuenta desde la app.
 */

import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const PROYECTO = process.env.GOOGLE_CLOUD_PROJECT || "demo-backupreader";
const HOST = process.env.BR_EMULATOR_HOST || "127.0.0.1";

/* Esto es lo que hace que admin hable con el emulador en vez de con Google.
   Tiene que estar puesto ANTES de getFirestore(). Sin credenciales: con un
   proyecto `demo-` el emulador no pide ninguna. */
process.env.FIRESTORE_EMULATOR_HOST = `${HOST}:8080`;

if (!getApps().length) initializeApp({ projectId: PROYECTO });
const db = getFirestore();

/* Los ids son fijos a propósito, para que puedas escribirlos a mano en las
   demás órdenes sin tener que ir a copiarlos de la consola.

   El precio del Personal es 2.99 porque PlansScreen busca ese número exacto;
   con cualquier otro, la pantalla de planes se queda vacía. */
const PLANES = {
  personal: {
    name: "Personal",
    price: 2.99,
    benefit: "Respalda tus conversaciones en la nube",
    storage: 200,
    currency: "USD",
    frequently: "Mensual",
    description: "Plan personal, pago mensual",
  },
  plus: {
    name: "Plus",
    price: 3.99,
    benefit: "Más espacio para tus conversaciones",
    storage: 400,
    currency: "USD",
    frequently: "Mensual",
    description: "Plan plus, pago mensual",
  },
  pro: {
    name: "Pro",
    price: 9.99,
    benefit: "Todo el espacio que necesites",
    storage: 1000,
    currency: "USD",
    frequently: "Mensual",
    description: "Plan pro, pago mensual",
  },
};

const DIA = 24 * 60 * 60 * 1000;

async function sembrarPlanes() {
  for (const [id, plan] of Object.entries(PLANES)) {
    await db.doc(`plans/${id}`).set({ plan });
    console.log(`  plans/${id}  ${plan.name}  $${plan.price}`);
  }
  console.log("\nListo. La pantalla /plans ya debería pintar el plan Personal.");
}

async function crearUsuario(uid, correo, idPlan) {
  await db.doc(`users/${uid}`).set(
    {
      user: {
        uid,
        email: correo ?? null,
        displayName: "Cuenta de prueba",
        photoURL: null,
        plan: idPlan,
      },
    },
    { merge: true }
  );
  console.log(`users/${uid} listo, con plan "${idPlan}".`);
}

async function cambiarPlan(uid, idPlan) {
  await db.doc(`users/${uid}`).set({ user: { plan: idPlan } }, { merge: true });
  console.log(
    idPlan ? `users/${uid} ahora tiene el plan "${idPlan}".` : `users/${uid} se quedó sin plan.`
  );
}

async function cancelar(uid, dias) {
  const cuando = Date.now() + dias * DIA;
  await db.doc(`users/${uid}`).set({ user: { planCancelAt: cuando } }, { merge: true });
  console.log(
    `planCancelAt = ${new Date(cuando).toISOString()} (${dias} días).\n` +
      (dias < 0
        ? "Está en el PASADO: al recargar, el dashboard debe echarte a /plans y\n" +
          "/account debe decir «Tu suscripción terminó el …» con el botón de ver planes."
        : "Está en el FUTURO: sigues entrando, y /account debe decir «Mantienes el\n" +
          "acceso hasta el …» con el botón de reactivar.")
  );
}

async function reactivar(uid) {
  await db.doc(`users/${uid}`).set({ user: { planCancelAt: null } }, { merge: true });
  console.log(`users/${uid}: planCancelAt quitado.`);
}

async function estado(uid) {
  const u = await db.doc(`users/${uid}`).get();
  const v = await db.doc(`vaults/${uid}`).get();
  const planes = await db.collection("plans").get();

  if (!u.exists) {
    console.log(`users/${uid} NO existe. Crea la cuenta desde la app primero.`);
    return;
  }
  const datos = u.data()?.user ?? {};
  const cancelAt = datos.planCancelAt ?? null;

  console.log(`uid           ${uid}`);
  console.log(`correo        ${datos.email ?? "(ninguno)"}`);
  console.log(`plan          ${datos.plan ?? "(ninguno)"}`);
  console.log(
    `planCancelAt  ${
      cancelAt
        ? `${new Date(cancelAt).toISOString()} (${cancelAt > Date.now() ? "en el futuro" : "VENCIDO"})`
        : "(sin cancelar)"
    }`
  );
  console.log(`bóveda        ${v.exists ? "creada" : "sin crear"}`);
  console.log(`plans         ${planes.size} documento(s)`);
}

// ---------------------------------------------------------------------------

const AYUDA = `
sembrar-emulador — datos de prueba en el Firestore del emulador

  planes                        Crea la colección plans
  usuario   <uid> [correo]      Crea users/{uid} con el plan Personal
  plan      <uid> <id|--quitar> Cambia el plan
  cancelar  <uid> [dias]        planCancelAt dentro de N días (negativo = pasado)
  reactivar <uid>               Quita planCancelAt
  estado    <uid>               Qué tiene ahora

  El uid sale de http://localhost:4000 -> Authentication.
  Planes disponibles: personal, plus, pro
`;

const [orden, ...args] = process.argv.slice(2);
const uid = args[0];

try {
  switch (orden) {
    case "planes":
      await sembrarPlanes();
      break;
    case "usuario":
      if (!uid) throw new Error("Falta el uid.");
      await crearUsuario(uid, args[1], "personal");
      break;
    case "plan":
      if (!uid || !args[1]) throw new Error("Falta el uid o el plan.");
      await cambiarPlan(uid, args[1] === "--quitar" ? null : args[1]);
      break;
    case "cancelar":
      if (!uid) throw new Error("Falta el uid.");
      await cancelar(uid, args[1] !== undefined ? Number(args[1]) : 30);
      break;
    case "reactivar":
      if (!uid) throw new Error("Falta el uid.");
      await reactivar(uid);
      break;
    case "estado":
      if (!uid) throw new Error("Falta el uid.");
      await estado(uid);
      break;
    default:
      console.log(AYUDA);
  }
} catch (e) {
  console.error("\nError:", e.message);
  console.error(
    `\n¿Está el emulador corriendo en ${HOST}:8080?\n` +
      "  npx firebase emulators:start --only firestore,storage,auth --project demo-backupreader"
  );
  process.exitCode = 1;
}
