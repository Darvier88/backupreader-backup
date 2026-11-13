import { NextApiRequest, NextApiResponse } from 'next';
import Stripe from "stripe";

import { importeDelPrecio, resolverCodigo } from "../../../lib/descuentos-stripe";

/**
 * Crea la suscripción, con código de descuento si viene uno.
 *
 * EL CÓDIGO SE VUELVE A RESOLVER AQUÍ
 * -----------------------------------
 * Llega el TEXTO del código, no el id que devolvió la validación, y se
 * resuelve otra vez contra Stripe. Dos razones:
 *
 *  - Entre que el usuario pulsa "Aplicar" y pulsa "Suscribirte" pueden pasar
 *    minutos. En ese rato el código puede agotarse, vencer o desactivarse.
 *  - Si se aceptara el id que manda el navegador, el descuento que se cobra
 *    dependería de un identificador de Stripe venido del cliente. Con el
 *    texto, lo único que el usuario puede mandar es lo que escribió.
 *
 * Y SI EL CÓDIGO YA NO VALE, NO SE COBRA
 * --------------------------------------
 * Se aborta en vez de seguir sin el descuento. Seguir significaría cobrar el
 * precio entero a quien acaba de ver en pantalla que iba a pagar menos: un
 * cargo por más dinero del que aceptó. Mejor un error que se puede reintentar
 * sin el código.
 */

const CLAVE = process.env.STRIPE_SECRET_KEY;

const stripe = new Stripe(`${CLAVE}`, {
    apiVersion: "2022-11-15",
});

const createSubscription = async (
  customerId: string,
  paymentMethodId: string,
  planId: string,
  promotionCodeId?: string
) => {

    await stripe?.paymentMethods.attach(paymentMethodId, {
        customer: customerId
    });


  const subscription = await stripe.subscriptions.create({
    customer: customerId,
    items: [{ plan: planId }],
    default_payment_method: paymentMethodId,
    expand: ['latest_invoice.payment_intent'],
    /* Solo va la clave si hay código: mandar `promotion_code: undefined`
       explícitamente es inofensivo, pero dejarlo fuera mantiene la llamada
       idéntica a la de siempre cuando nadie usa un descuento. */
    ...(promotionCodeId ? { promotion_code: promotionCodeId } : {}),
    //trial_period_days: 30,
  });

  return subscription;
};

const createSubscriptionHandler = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const { customerId, paymentMethodId, planId, discountCode } = req.body;

    if (!CLAVE) {
      console.error("Stripe sin configurar: falta STRIPE_SECRET_KEY.");
      return res.status(500).json({ success: false, error: "stripe-sin-configurar" });
    }

    let promotionCodeId: string | undefined;

    if (typeof discountCode === "string" && discountCode.trim()) {
      const precio = await importeDelPrecio(stripe, planId);
      if (!precio) {
        return res.status(400).json({ success: false, error: "precio-no-soportado" });
      }

      const r = await resolverCodigo(stripe, discountCode, precio.centavos, precio.moneda);
      if (!r.vale) {
        /* No se crea ni cliente ni suscripción: se devuelve el motivo para
           que la pantalla lo enseñe y el usuario decida si reintenta sin el
           código. */
        return res
          .status(200)
          .json({ success: false, codigoRechazado: true, motivo: r.motivo });
      }
      promotionCodeId = r.promotionCodeId;
    }

    const subscription = await createSubscription(
      customerId,
      paymentMethodId,
      planId,
      promotionCodeId
    );

    /* Con un descuento del 100% la primera factura sale en cero, Stripe la
       cobra sola y no hay payment intent que confirmar. Hay que decírselo a
       la pantalla: si no, enseñaría un mensaje de pago hecho hablando de un
       cargo que no existió. La tarjeta se guarda igual, porque cuando el
       descuento se acabe hay que poder cobrar la renovación. */
    const factura = subscription.latest_invoice as Stripe.Invoice | null;
    const sinCobroHoy = (factura?.amount_due ?? 0) === 0;

    res.status(200).json({
      success: true,
      customerId: customerId,
      sinCobroHoy,
      /* En centavos, tal como lo cobró Stripe: es la cifra de verdad, no la
         que calculó la pantalla. */
      cobradoCentavos: factura?.amount_due ?? null,
      moneda: factura?.currency ?? null,
      conDescuento: Boolean(promotionCodeId),
    });
  } catch (error: any) {
    /* Stripe rechaza el cupón con su propio error si algo se le escapó a
       nuestra comprobación. Se distingue para no enseñar "verifica los datos
       de tu tarjeta" cuando el problema era el código. */
    const esDelCupon =
      error?.code === "coupon_expired" ||
      error?.param === "promotion_code" ||
      error?.param === "coupon";

    if (esDelCupon) {
      console.error('Stripe rechazó el código de descuento:', error?.message);
      return res.status(200).json({
        success: false,
        codigoRechazado: true,
        motivo: "Ese código ya no se puede usar. Prueba sin él.",
      });
    }

    console.error('Error creating subscription:', error);
    res.status(500).json({ success: false, error: 'Failed to create subscription' });
  }
};

export default createSubscriptionHandler;
