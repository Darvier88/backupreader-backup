import { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';

/* Misma guarda que discounts/validate y subscriptions/create: sin clave no se
   llama a Stripe. */
const CLAVE = process.env.STRIPE_SECRET_KEY;

const stripe = new Stripe(`${CLAVE}`, {
    apiVersion: "2022-11-15",
});

const createCustomer = async (
  req: NextApiRequest,
  res: NextApiResponse
) => {
  if (!CLAVE) {
    console.error("Stripe sin configurar: falta STRIPE_SECRET_KEY.");
    return res.status(500).json({ error: "stripe-sin-configurar" });
  }

  const { name, email, uid } = req.body;

  try {
    /* El uid de Firebase va en metadata para poder encontrar luego a este
       cliente SIN depender del correo.
       Buscar por correo es frágil: basta con que el usuario pague con otra
       dirección, o cambie la de su cuenta, para que la cancelación no
       encuentre nada y haya que resolverlo a mano. */
    const customer = await stripe.customers.create({
      name: name,
      email: email,
      ...(uid ? { metadata: { firebaseUid: String(uid) } } : {}),
    });

    res.json({ customerId: customer.id });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export default createCustomer;
