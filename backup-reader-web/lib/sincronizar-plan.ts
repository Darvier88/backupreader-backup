import type Stripe from "stripe";

import { appDeAdmin, dbAdmin } from "./admin-servidor";
import { todasLasSuscripciones } from "./stripe-servidor";

/**
 * El plan de un usuario, sacado de Stripe y escrito en Firestore.
 *
 * Antes la web solo escribía el plan al pagar o al cancelar desde ella. Si un
 * cobro mensual fallaba, si se cancelaba desde Stripe o si Stripe la daba de
 * baja por impago, Firestore seguía diciendo que el plan valía. Y al volver a
 * contratar se quedaba la fecha de fin del plan viejo.
 *
 * Ahora la fuente de verdad es Stripe. Esto lo llaman:
 *  - el webhook de Stripe (pages/api/stripe/webhook), en cada cambio;
 *  - subscriptions/sync, al pagar y al abrir Mi cuenta, por si el webhook
 *    tarda o falló;
 *  - subscriptions/cancel, justo después de cancelar o reactivar.
 *
 * Se recalcula siempre desde TODAS las suscripciones del usuario, no desde el
 * evento que llegó: si alguien vuelve a contratar, el «deleted» de la vieja
 * no debe quitarle el acceso que le da la nueva. Y así da igual el orden en
 * que lleguen los eventos.
 */

export type EstadoDelPlan =
  /** No hay nada que cambiar (sin cliente en Stripe, o solo pagos sin
   *  confirmar). Se deja el documento como está: puede ser un plan puesto a
   *  mano o una cuenta de prueba. */
  | { tipo: "sin-cambios" }
  /** `plan` es el id del PRECIO de Stripe; `centavos`, su importe. Para
   *  guardarlo hay que traducirlo al id del documento de `plans`
   *  (planDeFirestore): no son el mismo id. */
  | { tipo: "plan"; plan: string; centavos: number | null; planCancelAt: number | null };

/** Da acceso mientras Stripe sigue intentando cobrar (`past_due`). */
const CON_ACCESO: Stripe.Subscription.Status[] = ["active", "trialing", "past_due"];

/** El id del precio de Stripe de la suscripción. */
function planDe(s: Stripe.Subscription): string | null {
  const item = s.items?.data?.[0];
  return (item?.plan?.id ?? item?.price?.id) || null;
}

/** El importe de lista (sin descuento), en centavos. */
function centavosDe(s: Stripe.Subscription): number | null {
  const item = s.items?.data?.[0];
  const n = item?.price?.unit_amount ?? item?.plan?.amount;
  return typeof n === "number" ? n : null;
}

/**
 * Decide el plan a partir de las suscripciones. Pura: se prueba sin Stripe.
 *
 * - Hay una con acceso: ese plan. Si está programada para cancelarse, la
 *   fecha de fin; si no, sin fecha. Entre varias, primero la que no se va a
 *   cancelar y luego la que dura más.
 * - No hay ninguna con acceso pero sí alguna terminada (cancelada, impagada,
 *   caducada): el plan de la más reciente con su fecha de fin, para que Mi
 *   cuenta diga «Tu suscripción terminó el…» y se corte el acceso.
 * - Solo hay pagos sin confirmar (`incomplete`), o nada: sin cambios.
 */
export function estadoDelPlan(subs: Stripe.Subscription[], ahora = Date.now()): EstadoDelPlan {
  const conAcceso = subs.filter((s) => CON_ACCESO.includes(s.status) && planDe(s));
  if (conAcceso.length > 0) {
    const finDe = (s: Stripe.Subscription) =>
      s.cancel_at ?? (s.cancel_at_period_end ? s.current_period_end : null);
    conAcceso.sort((a, b) => {
      const fa = finDe(a);
      const fb = finDe(b);
      if (!fa !== !fb) return fa ? 1 : -1;
      return (b.current_period_end ?? 0) - (a.current_period_end ?? 0);
    });
    const mejor = conAcceso[0];
    const fin = finDe(mejor);
    return { tipo: "plan", plan: planDe(mejor)!, centavos: centavosDe(mejor), planCancelAt: fin ? fin * 1000 : null };
  }

  const terminadas = subs.filter(
    (s) => ["canceled", "unpaid", "incomplete_expired"].includes(s.status) && planDe(s)
  );
  if (terminadas.length > 0) {
    const finDe = (s: Stripe.Subscription) =>
      s.ended_at ?? s.canceled_at ?? s.current_period_end ?? Math.floor(ahora / 1000);
    terminadas.sort((a, b) => finDe(b) - finDe(a));
    const ultima = terminadas[0];
    /* Nunca en el futuro: si ya no tiene acceso, la fecha de fin no puede
       quedar por delante (con `unpaid` el periodo puede no haber acabado). */
    const fin = Math.min(finDe(ultima) * 1000, ahora);
    return { tipo: "plan", plan: planDe(ultima)!, centavos: centavosDe(ultima), planCancelAt: fin };
  }

  return { tipo: "sin-cambios" };
}

/**
 * El id del documento de `plans` que corresponde a lo que cobra Stripe.
 *
 * En Firestore `user.plan` guarda el id del DOCUMENTO del plan (p. ej.
 * «NrcM81oeU0KMb6RYduBw»), no el del precio de Stripe («price_…»). Se
 * empareja por importe, igual que la web elige el precio al cobrar
 * (lib/precios-de-planes): plan.price × 100 == unit_amount. Si no hay
 * exactamente uno, null y no se escribe nada.
 */
export async function planDeFirestore(centavos: number | null): Promise<string | null> {
  if (centavos === null) return null;
  const snap = await dbAdmin().collection("plans").get();
  const con = snap.docs.filter((d) => Math.round(Number(d.get("plan.price")) * 100) === centavos);
  return con.length === 1 ? con[0].id : null;
}

export type ResultadoSincronizar =
  | { ok: true; escrito: boolean; plan: string | null; planCancelAt: number | null }
  /** Vercel sin cuenta de servicio: no se puede escribir en el servidor. */
  | { ok: false; error: "admin-sin-configurar" };

/**
 * Lee Stripe y escribe `user.plan` y `user.planCancelAt` con el Admin SDK.
 *
 * Solo toca esos dos campos y solo si el documento existe: no crea perfiles.
 */
export async function sincronizarPlan(uid: string, correo: string): Promise<ResultadoSincronizar> {
  if (!appDeAdmin()) return { ok: false, error: "admin-sin-configurar" };

  const { suscripciones } = await todasLasSuscripciones(uid, correo);
  const estado = estadoDelPlan(suscripciones);

  const ref = dbAdmin().collection("users").doc(uid);
  const snap = await ref.get();
  const actual = (snap.exists ? snap.get("user") : null) ?? {};

  const sinCambios = { ok: true as const, escrito: false, plan: actual.plan ?? null, planCancelAt: actual.planCancelAt ?? null };
  if (estado.tipo === "sin-cambios" || !snap.exists) return sinCambios;

  const plan = await planDeFirestore(estado.centavos);
  if (!plan) {
    console.error("No hay un plan en Firestore con el importe de", estado.plan, estado.centavos);
    return sinCambios;
  }

  const igual = actual.plan === plan && (actual.planCancelAt ?? null) === estado.planCancelAt;
  if (!igual) {
    await ref.update({ "user.plan": plan, "user.planCancelAt": estado.planCancelAt });
  }
  return { ok: true, escrito: !igual, plan, planCancelAt: estado.planCancelAt };
}
