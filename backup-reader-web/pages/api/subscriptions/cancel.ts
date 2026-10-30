import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";

/**
 * Cancelar (o reactivar) la suscripción del usuario que llama.
 *
 * Cancela con `cancel_at_period_end`, no al instante: el usuario ya pagó el
 * mes en curso y se le deja usarlo. Stripe deja de cobrar al llegar esa fecha.
 *
 * QUIÉN PUEDE LLAMAR
 * ------------------
 * El cliente manda su ID token de Firebase y aquí se verifica contra Google.
 * Sin eso, el endpoint recibiría un correo a secas y cualquiera podría cancelar
 * la suscripción de otro con solo conocer su dirección.
 *
 * Se verifica con la API REST de Identity Toolkit en vez de con firebase-admin
 * porque admin necesita credenciales de cuenta de servicio, que hoy no están
 * configuradas en Vercel. Esto solo necesita la API key pública que ya se usa
 * en el navegador.
 *
 * CÓMO SE ENCUENTRA LA SUSCRIPCIÓN
 * --------------------------------
 * Por el uid de Firebase, que se guarda en `metadata.firebaseUid` del cliente
 * de Stripe al crearlo. El uid sale del token ya verificado, así que no
 * depende de que el correo de Firebase y el de Stripe coincidan.
 *
 * El correo queda solo como respaldo, para los clientes creados antes de que
 * se guardara esa etiqueta.
 */

const CLAVE_STRIPE =
  process.env.STRIPE_SECRET_KEY || process.env.NEXT_PUBLIC_STRIPE_KEYS;

const stripe = new Stripe(`${CLAVE_STRIPE}`, { apiVersion: "2022-11-15" });

/** Estados en los que todavía hay algo que cancelar. */
/**
 * Estados en los que todavía hay algo que cancelar.
 *
 * `incomplete` entra a propósito: es una suscripción creada cuyo primer pago
 * aún no se ha confirmado. Dejarla fuera significaba responder "no encontramos
 * ninguna suscripción" a alguien que acaba de contratar, lo cual es falso y
 * además confunde al probarlo a mano.
 *
 * Fuera quedan los estados ya terminados —`canceled`, `incomplete_expired`,
 * `paused`—, donde no hay nada que hacer.
 */
const VIVAS: Stripe.Subscription.Status[] = [
  "active",
  "trialing",
  "past_due",
  "unpaid",
  "incomplete",
];

/**
 * Dónde se verifica el token.
 *
 * Normalmente, el Identity Toolkit de Google. Pero con los emuladores los
 * tokens son falsos y sin firmar, así que Google los rechaza y la cancelación
 * no se puede probar en local. El emulador de Auth expone esta misma API bajo
 * su propio host, de modo que apuntando ahí se sigue VERIFICANDO de verdad,
 * solo que contra el emulador.
 *
 * Esto no es un atajo que se salte la comprobación: la doble condición es
 * deliberada. En Vercel `NODE_ENV` vale siempre "production", así que este
 * camino no se puede activar en el sitio desplegado ni aunque alguien dejara
 * la variable del emulador puesta por error.
 */
function urlDeVerificacion(apiKey: string): string {
  const enEmulador =
    process.env.NODE_ENV !== "production" &&
    process.env.NEXT_PUBLIC_USE_EMULATORS === "1";

  if (enEmulador) {
    const host = process.env.NEXT_PUBLIC_EMULATOR_HOST || "127.0.0.1";
    return `http://${host}:9099/identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`;
  }
  return `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`;
}

/** Verifica el ID token contra Firebase. Devuelve uid y correo, o null. */
async function identidadDelToken(
  idToken: string
): Promise<{ uid: string; email: string } | null> {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) {
    console.error("Falta NEXT_PUBLIC_FIREBASE_API_KEY: no se puede verificar quién llama.");
    return null;
  }
  try {
    const r = await fetch(
      urlDeVerificacion(apiKey),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      }
    );
    if (!r.ok) return null;
    const data = await r.json();
    const u = data?.users?.[0];
    if (!u?.localId) return null;
    return { uid: u.localId, email: u.email ?? "" };
  } catch (err) {
    console.error("No se pudo verificar el token:", err);
    return null;
  }
}

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
async function clientesDelUsuario(
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

  const porCorreo = await stripe.customers.list({ email: correo, limit: 20 });
  return porCorreo.data;
}

/** Todas las suscripciones vivas de este usuario. */
async function suscripcionesVivas(
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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "method-not-allowed" });
  }

  if (!CLAVE_STRIPE) {
    console.error("Stripe sin configurar: falta STRIPE_SECRET_KEY.");
    return res.status(500).json({ ok: false, error: "stripe-sin-configurar" });
  }

  const { idToken, accion } = req.body ?? {};
  if (typeof idToken !== "string" || !idToken) {
    return res.status(401).json({ ok: false, error: "sin-token" });
  }

  const cancelar = accion !== "reactivar";

  const quien = await identidadDelToken(idToken);
  if (!quien) {
    return res.status(401).json({ ok: false, error: "token-invalido" });
  }

  try {
    const subs = await suscripcionesVivas(quien.uid, quien.email);

    /* Sin suscripción en Stripe no es un error: puede ser un plan puesto a
       mano, o una cuenta de prueba. Se dice tal cual para que la pantalla no
       prometa una cancelación que no ha ocurrido. */
    if (subs.length === 0) {
      return res.status(200).json({ ok: true, sinSuscripcion: true, suscripciones: 0 });
    }

    let finDePeriodo = 0;
    for (const s of subs) {
      const actualizada = await stripe.subscriptions.update(s.id, {
        cancel_at_period_end: cancelar,
      });
      finDePeriodo = Math.max(finDePeriodo, actualizada.current_period_end ?? 0);
    }

    return res.status(200).json({
      ok: true,
      sinSuscripcion: false,
      suscripciones: subs.length,
      cancelada: cancelar,
      /* En milisegundos, que es lo que espera Date en el cliente. */
      activoHasta: cancelar && finDePeriodo ? finDePeriodo * 1000 : null,
    });
  } catch (error: any) {
    console.error("Error al cambiar la suscripción:", error);
    return res.status(500).json({ ok: false, error: "fallo-en-stripe" });
  }
}
