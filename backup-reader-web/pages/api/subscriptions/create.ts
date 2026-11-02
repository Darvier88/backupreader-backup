import type { NextApiRequest, NextApiResponse } from "next";

import { identidadDelToken } from "../../../lib/servidor/identidad";
import { stripe, CLAVE_STRIPE, suscripcionesVivasDe } from "../../../lib/servidor/stripeCliente";

/**
 * Crea la suscripción, salvo que ya haya una.
 *
 * QUÉ ESTABA MAL
 * --------------
 * Esto creaba una suscripción cada vez que se llamaba, sin mirar si el cliente
 * ya tenía una. Ese es el fallo que acabó cobrando dos veces a dos personas
 * durante meses: lo de los clientes duplicados era el síntoma visible, pero
 * aunque hubiera un solo cliente, dos envíos del formulario dejaban dos
 * suscripciones activas sobre él.
 *
 * Ahora, si ya hay una viva, se devuelve esa y no se crea nada. Reintentar el
 * pago deja de poder cobrar de más.
 *
 * Además se comprueba quién llama y que el cliente sea suyo. Antes el
 * `customerId` venía en el cuerpo sin verificar, así que cualquiera podía
 * crear suscripciones sobre el cliente de otro.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ success: false, error: "method-not-allowed" });
  }

  if (!CLAVE_STRIPE) {
    console.error("Stripe sin configurar: falta STRIPE_SECRET_KEY.");
    return res.status(500).json({ success: false, error: "stripe-sin-configurar" });
  }

  const { customerId, paymentMethodId, planId, idToken } = req.body ?? {};

  if (!customerId || !paymentMethodId || !planId) {
    return res.status(400).json({ success: false, error: "faltan-datos" });
  }

  const quien = await identidadDelToken(idToken);
  if (!quien) {
    return res.status(401).json({ success: false, error: "token-invalido" });
  }

  try {
    /* El cliente tiene que ser de quien llama. Sin esto, mandando el
       customerId de otro se le podrían crear suscripciones encima.

       Se pide POR ID a propósito, en vez de buscar los clientes del usuario:
       la Search API de Stripe tarda hasta un minuto en indexar, y aquí el
       cliente se acaba de crear hace segundos. Buscándolo, la comprobación
       fallaría en mitad del pago. Un `retrieve` por id es consistente al
       instante. */
    const cliente = await stripe.customers.retrieve(customerId);

    /* `retrieve` devuelve Customer | DeletedCustomer, y solo el segundo tiene
       `deleted`, así que se comprueba con `in` en vez de leerlo a secas. */
    if ("deleted" in cliente && cliente.deleted) {
      return res.status(403).json({ success: false, error: "cliente-borrado" });
    }

    const etiqueta = cliente.metadata?.firebaseUid;
    /* Sin etiqueta solo puede ser un cliente anterior a que se guardara; se
       admite si el correo coincide, que es lo único comparable en ese caso. */
    const esSuyo = etiqueta
      ? etiqueta === quien.uid
      : Boolean(
          quien.email &&
            cliente.email &&
            cliente.email.trim().toLowerCase() === quien.email.trim().toLowerCase()
        );

    if (!esSuyo) {
      console.warn(`${quien.uid} intentó suscribir el cliente ajeno ${customerId}`);
      return res.status(403).json({ success: false, error: "cliente-ajeno" });
    }

    /* Ya tiene una: se devuelve y no se crea otra. Esto es lo que impide el
       cobro doble al reintentar. */
    const vivas = await suscripcionesVivasDe(customerId);
    if (vivas.length > 0) {
      console.info(`${customerId} ya tenía suscripción (${vivas[0].id}); no se crea otra.`);
      return res.status(200).json({
        success: true,
        customerId,
        subscriptionId: vivas[0].id,
        yaExistia: true,
      });
    }

    await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });

    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ plan: planId }],
      default_payment_method: paymentMethodId,
      expand: ["latest_invoice.payment_intent"],
    });

    return res.status(200).json({
      success: true,
      customerId,
      subscriptionId: subscription.id,
      yaExistia: false,
    });
  } catch (error: any) {
    console.error("Error creando la suscripción:", error);
    return res.status(500).json({ success: false, error: "Failed to create subscription" });
  }
}
