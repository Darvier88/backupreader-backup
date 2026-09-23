import { NextApiRequest, NextApiResponse } from 'next';
import Stripe from "stripe";


const stripe = new Stripe(`${process.env.NEXT_PUBLIC_STRIPE_KEYS}`, {
    apiVersion: "2022-11-15",
});

const createSubscription = async (customerId: string, paymentMethodId: string, planId: string) => {

    await stripe?.paymentMethods.attach(paymentMethodId, {
        customer: customerId
    });
    

  const subscription = await stripe.subscriptions.create({
    customer: customerId,
    items: [{ plan: planId }],
    default_payment_method: paymentMethodId,
    expand: ['latest_invoice.payment_intent'],
    //trial_period_days: 30,
  });

  return subscription;
};

const createSubscriptionHandler = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const { customerId, paymentMethodId, planId } = req.body;
    console.log('Im receiving '+customerId+' payment method ID '+paymentMethodId+' PlanID: '+planId)
    const subscription = await createSubscription(customerId, paymentMethodId, planId);
    res.status(200).json({ success: true, customerId: customerId });
  } catch (error) {
    console.error('Error creating subscription:', error);
    res.status(500).json({ success: false, error: 'Failed to create subscription' });
  }
};

export default createSubscriptionHandler;
