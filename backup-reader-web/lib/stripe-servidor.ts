import Stripe from "stripe";

/**
 * Stripe en el servidor: el cliente y cómo encontrar a un usuario en él.
 *
 * Salió de subscriptions/cancel para compartirlo con subscriptions/sync y el
 * webhook. Solo se importa desde pages/api: lleva la clave secreta.
 */

export const CLAVE_STRIPE = process.env.STRIPE_SECRET_KEY;

export const stripe = new Stripe(`${CLAVE_STRIPE}`, { apiVersion: "2022-11-15" });

/**
 * Estados en los que todavía hay algo que cancelar.
 *
 * `incomplete` entra a propósito: es una suscripción creada cuyo primer pago
 * aún no se ha confirmado. Fuera quedan los ya terminados —`canceled`,
 * `incomplete_expired`, `paused`—, donde no hay nada que hacer.
 */
export const VIVAS: Stripe.Subscription.Status[] = [
  "active",
  "trialing",
  "past_due",
  "unpaid",
  "incomplete",
];

/**
 * Los clientes de Stripe de este usuario.
 *
 * Primero por el uid que se guarda en `metadata.firebaseUid` al crear el
 * cliente. Es lo fiable: el uid viene del token ya verificado, así que no
 * depende de que el correo de Firebase y el de Stripe coincidan.
 *
 * El correo queda como respaldo para quien pagó ANTES de que se empezara a
 * guardar esa etiqueta. Se puede retirar cuando ya no queden clientes viejos.
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
    /* La API de búsqueda puede no estar disponible en cuentas muy antiguas.
       No es motivo para dejar al usuario sin poder cancelar: se sigue por
       correo. */
    console.warn("Búsqueda por metadata no disponible, se usa el correo:", err);
  }

  /* Sin correo no se busca: `customers.list` con un email vacío devolvería
     los clientes de TODO el mundo. */
  if (!correo) return [];
  const porCorreo = await stripe.customers.list({ email: correo, limit: 20 });
  return porCorreo.data;
}

/** Todas las suscripciones vivas de este usuario. */
export async function suscripcionesVivas(
  uid: string,
  correo: string
): Promise<Stripe.Subscription[]> {
  const clientes = await clientesDelUsuario(uid, correo);
  const salida: Stripe.Subscription[] = [];
  for (const cliente of clientes) {
    const subs = await stripe.subscriptions.list({
      customer: cliente.id,
      status: "all",
      limit: 100,
    });
    salida.push(...subs.data.filter((s) => VIVAS.includes(s.status)));
  }
  return salida;
}


/** Todas las suscripciones del usuario, en cualquier estado. */
export async function todasLasSuscripciones(
  uid: string,
  correo: string
): Promise<{ clientes: number; suscripciones: Stripe.Subscription[] }> {
  const clientes = await clientesDelUsuario(uid, correo);
  const salida: Stripe.Subscription[] = [];
  for (const cliente of clientes) {
    const subs = await stripe.subscriptions.list({ customer: cliente.id, status: "all", limit: 100 });
    salida.push(...subs.data);
  }
  return { clientes: clientes.length, suscripciones: salida };
}
