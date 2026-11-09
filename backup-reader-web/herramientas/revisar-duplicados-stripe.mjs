#!/usr/bin/env node
/**
 * revisar-duplicados-stripe — clientes repetidos y cobros dobles.
 *
 * SOLO LEE. No escribe nada en Stripe.
 *
 * POR QUÉ
 * -------
 * `/api/customer/create` crea un cliente nuevo en CADA intento de pago, sin
 * mirar si esa persona ya tiene uno. Un reintento —tarjeta rechazada, recarga,
 * doble clic— deja dos clientes con el mismo correo. Si los dos acabaron con
 * suscripción activa, a esa persona se le está cobrando dos veces.
 *
 * Esto agrupa los clientes por correo y, para los repetidos, enseña el estado
 * de cada suscripción, para poder distinguir el duplicado inofensivo (uno
 * activo, otro vacío) del cobro doble (dos activos).
 *
 * USO
 *   $env:STRIPE_SECRET_KEY="sk_..."
 *   node herramientas/revisar-duplicados-stripe.mjs
 *   node herramientas/revisar-duplicados-stripe.mjs --todos   (también los únicos)
 */

import Stripe from "stripe";

const CLAVE = process.env.STRIPE_SECRET_KEY || process.env.NEXT_PUBLIC_STRIPE_KEYS;
if (!CLAVE) {
  console.error("Falta STRIPE_SECRET_KEY en el entorno.");
  process.exit(1);
}

const stripe = new Stripe(CLAVE, { apiVersion: "2022-11-15" });
const todos = process.argv.includes("--todos");
const modo = CLAVE.startsWith("sk_live") ? "PRODUCCIÓN (live)" : "prueba (test)";

/** Estados por los que Stripe cobra o espera cobrar. */
const COBRANDO = ["active", "trialing", "past_due", "unpaid", "incomplete"];

async function todosLosClientes() {
  const salida = [];
  let starting_after;
  for (;;) {
    const p = await stripe.customers.list({ limit: 100, ...(starting_after ? { starting_after } : {}) });
    salida.push(...p.data);
    if (!p.has_more) break;
    starting_after = p.data[p.data.length - 1].id;
  }
  return salida;
}

async function suscripcionesDe(customerId) {
  const subs = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 100 });
  return subs.data.map((s) => ({
    id: s.id,
    estado: s.status,
    cobrando: COBRANDO.includes(s.status),
    cancelaAlFinal: s.cancel_at_period_end,
    fin: s.current_period_end ? new Date(s.current_period_end * 1000).toISOString().slice(0, 10) : "—",
  }));
}

async function principal() {
  console.log(`Stripe: ${modo}\n`);

  const clientes = await todosLosClientes();
  const porCorreo = new Map();
  for (const c of clientes) {
    const correo = (c.email || "(sin correo)").trim().toLowerCase();
    if (!porCorreo.has(correo)) porCorreo.set(correo, []);
    porCorreo.get(correo).push(c);
  }

  const grupos = [...porCorreo.entries()].filter(([, cs]) => todos || cs.length > 1);

  console.log(`clientes               ${clientes.length}`);
  console.log(`correos distintos      ${porCorreo.size}`);
  console.log(`correos repetidos      ${[...porCorreo.values()].filter((c) => c.length > 1).length}\n`);

  let cobrosDobles = 0;

  for (const [correo, cs] of grupos) {
    const lineas = [];
    let cobrandoEnEsteCorreo = 0;

    for (const c of cs) {
      const subs = await suscripcionesDe(c.id);
      const vivas = subs.filter((s) => s.cobrando);
      cobrandoEnEsteCorreo += vivas.length;
      lineas.push(
        `    ${c.id}  uid=${c.metadata?.firebaseUid ?? "(sin etiqueta)"}\n` +
          (subs.length === 0
            ? "      sin suscripciones\n"
            : subs
                .map(
                  (s) =>
                    `      ${s.id}  ${s.estado}` +
                    (s.cancelaAlFinal ? `  (cancela el ${s.fin})` : "") +
                    (s.cobrando ? "  <-- cobrando" : "")
                )
                .join("\n") + "\n")
      );
    }

    const alerta = cobrandoEnEsteCorreo > 1;
    if (alerta) cobrosDobles++;

    console.log(`${alerta ? "!! COBRO DOBLE" : "  "} ${correo}  (${cs.length} cliente(s))`);
    console.log(lineas.join(""));
  }

  if (cobrosDobles > 0) {
    console.log(
      `\n${cobrosDobles} correo(s) con MÁS DE UNA suscripción cobrando.\n` +
        "Esas personas están pagando de más. Hay que cancelar la sobrante en\n" +
        "Stripe y, si lleva meses, devolverles la diferencia."
    );
  } else {
    console.log("\nNingún correo tiene más de una suscripción cobrando.");
  }
}

principal().catch((e) => {
  console.error("\nError:", e.message);
  process.exitCode = 1;
});
