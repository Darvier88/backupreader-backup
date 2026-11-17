import type { NextApiRequest, NextApiResponse } from "next";

import { CLAVE_STRIPE } from "../../../lib/stripe-servidor";
import { identidadDelToken } from "../../../lib/identidad-token";
import { sincronizarPlan } from "../../../lib/sincronizar-plan";

/**
 * Pone el plan del usuario que llama al día con Stripe.
 *
 * Lo llama la web al terminar de pagar y al abrir Mi cuenta. El webhook hace
 * lo mismo en cuanto Stripe avisa, pero esto cubre que el aviso tarde, que
 * falle, o que el webhook todavía no esté configurado. Solo actúa sobre el
 * usuario del token: el uid sale del token verificado, no del cuerpo.
 *
 * Respuesta: { ok, escritoEnServidor, plan, planCancelAt }. Con
 * `escritoEnServidor: false` (Vercel sin cuenta de servicio) la web escribe
 * el plan ella misma, como antes.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "method-not-allowed" });
  }
  if (!CLAVE_STRIPE) {
    return res.status(500).json({ ok: false, error: "stripe-sin-configurar" });
  }

  const { idToken } = req.body ?? {};
  if (typeof idToken !== "string" || !idToken) {
    return res.status(401).json({ ok: false, error: "sin-token" });
  }
  const quien = await identidadDelToken(idToken);
  if (!quien) return res.status(401).json({ ok: false, error: "token-invalido" });

  try {
    const r = await sincronizarPlan(quien.uid, quien.email);
    if (!r.ok) {
      return res.status(200).json({ ok: true, escritoEnServidor: false });
    }
    return res.status(200).json({
      ok: true,
      escritoEnServidor: true,
      cambiado: r.escrito,
      plan: r.plan,
      planCancelAt: r.planCancelAt,
    });
  } catch (error) {
    console.error("Error al sincronizar el plan:", error);
    return res.status(500).json({ ok: false, error: "fallo-al-sincronizar" });
  }
}
