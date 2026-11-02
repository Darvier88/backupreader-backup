import Stripe from "stripe";

/**
 * El cliente de Stripe del servidor, en un solo sitio.
 *
 * Sobre el nombre de la variable: la clave secreta vivía en
 * `NEXT_PUBLIC_STRIPE_KEYS`, y ese prefijo declara una variable como pública
 * —Next inyecta todo lo que lo lleve en el bundle del navegador—. Hoy no
 * acababa en el bundle porque solo se usaba dentro de `pages/api/`, que Next
 * no empaqueta para el cliente, pero bastaba que alguien la leyera desde un
 * componente para filtrar una clave de producción sin ningún aviso.
 *
 * Se lee `STRIPE_SECRET_KEY` primero y se cae al nombre viejo como respaldo,
 * para poder desplegar el cambio antes de tocar las variables en Vercel sin
 * que los pagos se caigan entre medias.
 */
export const CLAVE_STRIPE =
  process.env.STRIPE_SECRET_KEY || process.env.NEXT_PUBLIC_STRIPE_KEYS;

export const stripe = new Stripe(`${CLAVE_STRIPE}`, { apiVersion: "2022-11-15" });

/** Estados en los que Stripe cobra, o espera cobrar, una suscripción. */
export const SUSCRIPCION_VIVA: Stripe.Subscription.Status[] = [
  "active",
  "trialing",
  "past_due",
  "unpaid",
  "incomplete",
];

/**
 * Los clientes de Stripe de un usuario.
 *
 * Primero por el uid que se guarda en `metadata.firebaseUid`. Es lo fiable: el
 * uid viene del token ya verificado, así que no depende de que el correo de
 * Firebase y el de Stripe coincidan.
 *
 * El correo queda como respaldo para quien pagó ANTES de que se empezara a
 * guardar esa etiqueta, y por si la Search API no responde: mejor eso que
 * dejar a alguien sin poder cancelar.
 */
export async function clientesDelUsuario(
  uid: string,
  correo: string
): Promise<Stripe.Customer[]> {
  try {
    const porUid = await stripe.customers.search({
      query: `metadata['firebaseUid']:'${uid}'`,
      limit: 20,
    });
    if (porUid.data.length > 0) return porUid.data;
  } catch (err) {
    console.warn("Búsqueda por metadata no disponible, se usa el correo:", err);
  }

  if (!correo) return [];
  const porCorreo = await stripe.customers.list({ email: correo, limit: 20 });
  return porCorreo.data;
}

/** Las suscripciones vivas de un cliente concreto. */
export async function suscripcionesVivasDe(
  customerId: string
): Promise<Stripe.Subscription[]> {
  const subs = await stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 100,
  });
  return subs.data.filter((s) => SUSCRIPCION_VIVA.includes(s.status));
}
