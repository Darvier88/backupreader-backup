import type { NextApiRequest, NextApiResponse } from "next";

import { identidadDelToken } from "../../../lib/servidor/identidad";
import { stripe, CLAVE_STRIPE, clientesDelUsuario } from "../../../lib/servidor/stripeCliente";

/**
 * Devuelve el cliente de Stripe de quien llama, creándolo solo si no existe.
 *
 * QUÉ ESTABA MAL
 * --------------
 * Antes esto SIEMPRE creaba un cliente nuevo. Como se llama en cada envío del
 * formulario de pago, cada reintento —tarjeta rechazada, recarga, doble
 * clic— dejaba otro cliente con el mismo correo. En producción eso dejó 6
 * correos repetidos y 13 clientes que nunca pagaron, y en dos casos acabó en
 * dos suscripciones activas a la vez, cobrando dos veces a la misma persona
 * durante meses.
 *
 * Ahora busca antes de crear, así que llamarlo dos veces devuelve el mismo
 * cliente. Es idempotente desde el punto de vista de quien llama.
 *
 * Y el uid ya no se cree: antes llegaba en el cuerpo, donde lo pone quien
 * llama y no prueba nada. Ahora sale del token verificado.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method-not-allowed" });
  }

  if (!CLAVE_STRIPE) {
    console.error("Stripe sin configurar: falta STRIPE_SECRET_KEY.");
    return res.status(500).json({ error: "stripe-sin-configurar" });
  }

  const { name, email, idToken } = req.body ?? {};

  const quien = await identidadDelToken(idToken);
  if (!quien) {
    return res.status(401).json({ error: "token-invalido" });
  }

  /* El correo de facturación puede ser otro —mucha gente paga con el del
     trabajo—, así que se respeta el que venga. Para BUSCAR se usan los dos:
     el de la cuenta y el que escribió en el formulario. */
  const correoFacturacion = typeof email === "string" && email ? email : quien.email;

  try {
    const existentes = await clientesDelUsuario(quien.uid, correoFacturacion);

    /* Si ya hay cliente, se reutiliza el más reciente. Cuando se encontró por
       correo le falta la etiqueta: se le pone ahora, y así los clientes
       antiguos se van arreglando solos a medida que vuelven a pasar por aquí. */
    if (existentes.length > 0) {
      const cliente = existentes[0];
      if (!cliente.metadata?.firebaseUid) {
        await stripe.customers.update(cliente.id, {
          metadata: { ...cliente.metadata, firebaseUid: quien.uid },
        });
      }
      return res.json({ customerId: cliente.id, reutilizado: true });
    }

    /* Y si el correo de la cuenta es distinto del de facturación, se mira
       también por ese antes de dar por hecho que no existe. */
    if (quien.email && quien.email !== correoFacturacion) {
      const porCorreoDeCuenta = await clientesDelUsuario(quien.uid, quien.email);
      if (porCorreoDeCuenta.length > 0) {
        const cliente = porCorreoDeCuenta[0];
        if (!cliente.metadata?.firebaseUid) {
          await stripe.customers.update(cliente.id, {
            metadata: { ...cliente.metadata, firebaseUid: quien.uid },
          });
        }
        return res.json({ customerId: cliente.id, reutilizado: true });
      }
    }

    const cliente = await stripe.customers.create({
      name: typeof name === "string" ? name : undefined,
      email: correoFacturacion,
      metadata: { firebaseUid: quien.uid },
    });

    return res.json({ customerId: cliente.id, reutilizado: false });
  } catch (error: any) {
    console.error("Error obteniendo el cliente de Stripe:", error);
    return res.status(500).json({ error: "fallo-en-stripe" });
  }
}
