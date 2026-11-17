import type { NextApiRequest, NextApiResponse } from "next";
import type Stripe from "stripe";

import { stripe } from "../../../lib/stripe-servidor";
import { appDeAdmin, authAdmin } from "../../../lib/admin-servidor";
import { sincronizarPlan } from "../../../lib/sincronizar-plan";

/**
 * Webhook de Stripe: cada cambio de una suscripción pone el plan al día.
 *
 * Eventos que hay que activar en Stripe (Developers → Webhooks):
 *   customer.subscription.created
 *   customer.subscription.updated
 *   customer.subscription.deleted
 * `updated` cubre los cobros fallidos (pasa a past_due / unpaid), las
 * cancelaciones hechas desde el panel de Stripe y las renovaciones.
 *
 * Seguridad: se comprueba la firma con STRIPE_WEBHOOK_SECRET sobre el cuerpo
 * EN CRUDO (por eso se apaga el bodyParser). Sin firma válida no se hace nada.
 *
 * No se fía del contenido del evento para decidir el plan: con el cliente se
 * averigua el usuario y se recalcula desde Stripe (lib/sincronizar-plan).
 */
export const config = { api: { bodyParser: false } };

async function cuerpoEnCrudo(req: NextApiRequest): Promise<Buffer> {
  const trozos: Buffer[] = [];
  for await (const trozo of req) trozos.push(typeof trozo === "string" ? Buffer.from(trozo) : trozo);
  return Buffer.concat(trozos);
}

const EVENTOS = new Set([
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
]);

/** El usuario de Firebase del cliente de Stripe: por metadata, o por correo. */
async function usuarioDelCliente(clienteId: string): Promise<{ uid: string; correo: string } | null> {
  const cliente = await stripe.customers.retrieve(clienteId);
  if (!cliente || (cliente as Stripe.DeletedCustomer).deleted) return null;
  const c = cliente as Stripe.Customer;
  const correo = c.email ?? "";
  const uid = c.metadata?.firebaseUid;
  if (uid) return { uid, correo };
  /* Clientes creados antes de guardar el uid: se busca la cuenta por correo. */
  if (!correo) return null;
  try {
    const u = await authAdmin().getUserByEmail(correo);
    return { uid: u.uid, correo };
  } catch {
    return null;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end();
  }

  const secreto = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secreto) {
    console.error("Webhook de Stripe sin configurar: falta STRIPE_WEBHOOK_SECRET.");
    return res.status(500).json({ error: "webhook-sin-configurar" });
  }

  let evento: Stripe.Event;
  try {
    const firma = req.headers["stripe-signature"];
    evento = stripe.webhooks.constructEvent(await cuerpoEnCrudo(req), String(firma ?? ""), secreto);
  } catch (err: any) {
    console.error("Firma del webhook no válida:", err?.message);
    return res.status(400).json({ error: "firma-invalida" });
  }

  if (!EVENTOS.has(evento.type)) return res.status(200).json({ recibido: true, ignorado: true });

  if (!appDeAdmin()) {
    /* 500 a propósito: Stripe reintenta durante días, así que cuando se
       configure la cuenta de servicio los avisos pendientes entran solos. */
    return res.status(500).json({ error: "admin-sin-configurar" });
  }

  try {
    const sub = evento.data.object as Stripe.Subscription;
    const clienteId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
    if (!clienteId) return res.status(200).json({ recibido: true, sinCliente: true });

    const usuario = await usuarioDelCliente(clienteId);
    if (!usuario) {
      console.warn("Webhook: no se encontró el usuario del cliente", clienteId);
      return res.status(200).json({ recibido: true, sinUsuario: true });
    }

    const r = await sincronizarPlan(usuario.uid, usuario.correo);
    return res.status(200).json({ recibido: true, escrito: r.ok && r.escrito });
  } catch (error) {
    console.error("Error procesando el webhook de Stripe:", error);
    return res.status(500).json({ error: "fallo" });
  }
}
