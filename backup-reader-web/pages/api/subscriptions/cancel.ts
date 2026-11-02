import type { NextApiRequest, NextApiResponse } from "next";

import { identidadDelToken } from "../../../lib/servidor/identidad";
import {
  stripe,
  CLAVE_STRIPE,
  clientesDelUsuario,
  suscripcionesVivasDe,
} from "../../../lib/servidor/stripeCliente";

/**
 * Cancelar (o reactivar) la suscripción de quien llama.
 *
 * Cancela con `cancel_at_period_end`, no al instante: el usuario ya pagó el
 * mes en curso y se le deja usarlo. Stripe deja de cobrar al llegar esa fecha.
 *
 * QUIÉN PUEDE LLAMAR
 * ------------------
 * El cliente manda su ID token de Firebase y aquí se verifica. Sin eso, el
 * endpoint recibiría un correo a secas y cualquiera podría cancelar la
 * suscripción de otro con solo conocer su dirección.
 *
 * CÓMO SE ENCUENTRA LA SUSCRIPCIÓN
 * --------------------------------
 * Por el uid de Firebase, que se guarda en `metadata.firebaseUid` del cliente
 * de Stripe. El uid sale del token ya verificado, así que no depende de que el
 * correo de Firebase y el de Stripe coincidan. El correo queda solo como
 * respaldo, para los clientes creados antes de que se guardara esa etiqueta.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "method-not-allowed" });
  }

  if (!CLAVE_STRIPE) {
    console.error("Stripe sin configurar: falta STRIPE_SECRET_KEY.");
    return res.status(500).json({ ok: false, error: "stripe-sin-configurar" });
  }

  const { idToken, accion } = req.body ?? {};
  const cancelar = accion !== "reactivar";

  const quien = await identidadDelToken(idToken);
  if (!quien) {
    return res.status(401).json({ ok: false, error: "token-invalido" });
  }

  try {
    const clientes = await clientesDelUsuario(quien.uid, quien.email);
    const subs = [];
    for (const c of clientes) {
      subs.push(...(await suscripcionesVivasDe(c.id)));
    }

    /* Sin suscripción en Stripe no es un error: puede ser un plan puesto a
       mano, o una cuenta de prueba. Se dice tal cual para que la pantalla no
       prometa una cancelación que no ha ocurrido. */
    if (subs.length === 0) {
      return res.status(200).json({ ok: true, sinSuscripcion: true, suscripciones: 0 });
    }

    let finDePeriodo = 0;
    for (const s of subs) {
      const actualizada = await stripe.subscriptions.update(s.id, {
        cancel_at_period_end: cancelar,
      });
      finDePeriodo = Math.max(finDePeriodo, actualizada.current_period_end ?? 0);
    }

    return res.status(200).json({
      ok: true,
      sinSuscripcion: false,
      suscripciones: subs.length,
      cancelada: cancelar,
      /* En milisegundos, que es lo que espera Date en el cliente. */
      activoHasta: cancelar && finDePeriodo ? finDePeriodo * 1000 : null,
    });
  } catch (error: any) {
    console.error("Error al cambiar la suscripción:", error);
    return res.status(500).json({ ok: false, error: "fallo-en-stripe" });
  }
}
