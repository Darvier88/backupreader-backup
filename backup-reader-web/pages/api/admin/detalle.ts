/**
 * El detalle de Stripe de UN usuario: cliente, suscripción y cuánto pagó.
 *
 * Separado del listado porque mirar Stripe cuesta varias llamadas por usuario
 * y la tabla tiene que pintar rápido. Esto se pide al abrir una fila, y
 * también antes de confirmar un borrado: así el admin ve qué hay en juego
 * —una suscripción viva, dinero cobrado— en vez de borrar a ciegas.
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { authAdmin, soloSuperAdmin } from "../../../lib/admin-servidor";
import { resumenDeStripe, stripeConfigurado } from "../../../lib/admin-stripe";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const quien = await soloSuperAdmin(req, res);
  if (!quien) return;

  const { uid } = req.body ?? {};
  if (typeof uid !== "string" || !uid) {
    return res.status(400).json({ ok: false, error: "sin-uid" });
  }

  if (!stripeConfigurado()) {
    return res.status(500).json({ ok: false, error: "stripe-sin-configurar" });
  }

  try {
    /* El correo se saca de Auth, no del cuerpo de la petición: si lo mandara
       el cliente, un correo cualquiera traería los pagos de otra persona. */
    const cuenta = await authAdmin().getUser(uid);
    const stripe = await resumenDeStripe(uid, cuenta.email ?? "");
    return res.status(200).json({ ok: true, uid, stripe });
  } catch (error: any) {
    if (error?.code === "auth/user-not-found") {
      return res.status(404).json({ ok: false, error: "no-existe" });
    }
    console.error("Administración: fallo al consultar Stripe de", uid, error);
    return res.status(500).json({ ok: false, error: "fallo-en-stripe" });
  }
}
