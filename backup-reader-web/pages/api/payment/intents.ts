import { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";



const stripe = new Stripe(`${process.env.NEXT_PUBLIC_STRIPE_KEYS}`, {
  apiVersion: "2022-11-15",
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === "POST") {
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
      return res.status(error?.statusCode).json(error);
    }
  }
}
