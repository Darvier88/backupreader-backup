import { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";

/* Misma guarda que discounts/validate y subscriptions/create: sin clave no se
   llama a Stripe. Antes se le mandaba la cadena "undefined" y el error de
   Stripe, con sus cabeceras y su request id, llegaba entero al navegador. */
const CLAVE = process.env.STRIPE_SECRET_KEY;

const stripe = new Stripe(`${CLAVE}`, {
  apiVersion: "2022-11-15",
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === "POST") {
    if (!CLAVE) {
      console.error("Stripe sin configurar: falta STRIPE_SECRET_KEY.");
      return res.status(500).json({ ok: false, error: "stripe-sin-configurar" });
    }
    try {
      const { amount, description } = JSON.parse(req.body);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
        description: description,
      });
      res.status(200).json(paymentIntent);
    } catch (error: any) {
      /* Solo el mensaje y el código, no el objeto de error de Stripe entero.
         Y un 500 si no trae statusCode: res.status(undefined) revienta. */
      console.error("Fallo al crear el PaymentIntent:", error);
      return res
        .status(Number(error?.statusCode) || 500)
        .json({ ok: false, error: error?.code || "fallo-en-stripe", mensaje: error?.message || "" });
    }
  }
}
