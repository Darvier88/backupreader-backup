import { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';

const stripe = new Stripe(`${process.env.NEXT_PUBLIC_STRIPE_KEYS}`, {
    apiVersion: "2022-11-15",
});

const createCustomer = async (
  req: NextApiRequest,
  res: NextApiResponse
) => {
  const { name, email } = req.body;

  console.log('Im trying to create a customer here...')

  try {
    const customer = await stripe.customers.create({
      name: name,
      email: email,
    });

    res.json({ customerId: customer.id });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export default createCustomer;
