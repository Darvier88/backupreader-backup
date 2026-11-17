import type { NextApiRequest, NextApiResponse } from "next";
import { CLAVE_STRIPE, stripe, suscripcionesVivas } from "../../../lib/stripe-servidor";
import { identidadDelToken } from "../../../lib/identidad-token";
import { sincronizarPlan } from "../../../lib/sincronizar-plan";

/**
 * Cancelar (o reactivar) la suscripción del usuario que llama.
 *
 * Cancela con `cancel_at_period_end`, no al instante: el usuario ya pagó el
 * mes en curso y se le deja usarlo. Stripe deja de cobrar al llegar esa fecha.
 *
 * QUIÉN PUEDE LLAMAR
 * ------------------
 * El cliente manda su ID token de Firebase y aquí se verifica contra Google.
 * Sin eso, el endpoint recibiría un correo a secas y cualquiera podría cancelar
 * la suscripción de otro con solo conocer su dirección.
 *
 * Se verifica con la API REST de Identity Toolkit en vez de con firebase-admin
 * porque admin necesita credenciales de cuenta de servicio, que hoy no están
 * configuradas en Vercel. Esto solo necesita la API key pública que ya se usa
 * en el navegador.
 *
 * CÓMO SE ENCUENTRA LA SUSCRIPCIÓN
 * --------------------------------
 * Por el uid de Firebase, que se guarda en `metadata.firebaseUid` del cliente
 * de Stripe al crearlo. El uid sale del token ya verificado, así que no
 * depende de que el correo de Firebase y el de Stripe coincidan.
 *
 * El correo queda solo como respaldo, para los clientes creados antes de que
 * se guardara esa etiqueta.
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
  if (typeof idToken !== "string" || !idToken) {
    return res.status(401).json({ ok: false, error: "sin-token" });
  }

  const cancelar = accion !== "reactivar";

  const quien = await identidadDelToken(idToken);
  if (!quien) {
    return res.status(401).json({ ok: false, error: "token-invalido" });
  }

  try {
    const subs = await suscripcionesVivas(quien.uid, quien.email);

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

    /* Y el plan se escribe aquí, en el servidor, con lo que diga Stripe
       ahora. Las reglas ya no dejan que el navegador escriba su propio plan.
       Si Vercel no tiene cuenta de servicio, el navegador lo escribe como
       antes (`escritoEnServidor: false`). */
    let escritoEnServidor = false;
    try {
      const r = await sincronizarPlan(quien.uid, quien.email);
      escritoEnServidor = r.ok;
    } catch (err) {
      console.error("No se pudo sincronizar el plan tras cancelar:", err);
    }

    return res.status(200).json({
      ok: true,
      sinSuscripcion: false,
      suscripciones: subs.length,
      cancelada: cancelar,
      escritoEnServidor,
      /* En milisegundos, que es lo que espera Date en el cliente. */
      activoHasta: cancelar && finDePeriodo ? finDePeriodo * 1000 : null,
    });
  } catch (error: any) {
    console.error("Error al cambiar la suscripción:", error);
    return res.status(500).json({ ok: false, error: "fallo-en-stripe" });
  }
}
