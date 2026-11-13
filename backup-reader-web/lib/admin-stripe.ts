/**
 * El lado de Stripe de la administración: mirar qué pagó un usuario, cortarle
 * el cobro y, si se pide, devolverle el dinero.
 *
 * QUÉ SE PUEDE Y QUÉ NO SE PUEDE BORRAR EN STRIPE
 * -----------------------------------------------
 * "Eliminar usuarios junto con sus pagos" no se puede cumplir al pie de la
 * letra, y conviene tenerlo claro antes de leer el código:
 *
 *  - Los COBROS no se borran. Stripe no tiene forma de eliminar un charge, un
 *    payment intent ni una factura, y es a propósito: son el registro
 *    contable de un dinero que se movió de verdad. Ni la API ni el panel lo
 *    permiten.
 *  - La SUSCRIPCIÓN sí se cancela, y aquí se cancela al instante, no al final
 *    del periodo: si la cuenta se va, no tiene sentido seguir cobrándola.
 *  - El CLIENTE sí se borra. Al borrarlo, Stripe cancela sus suscripciones y
 *    desvincula sus métodos de pago. Los cobros siguen existiendo, pero
 *    colgados de un cliente borrado.
 *  - El DINERO se puede devolver, que es lo más cerca que hay de "borrar un
 *    pago". Va aparte y apagado por defecto: borrar una cuenta y devolver
 *    plata son dos decisiones distintas y mezclarlas sería caro de
 *    equivocarse.
 *
 * Así que el borrado deja a Stripe sin cliente y sin cobro futuro, y deja el
 * historial de lo ya cobrado intacto. Eso no es una limitación que haya que
 * disculpar: es lo que hace falta para cuadrar la contabilidad y para
 * responder una disputa.
 */

import Stripe from "stripe";

const CLAVE =
  process.env.STRIPE_SECRET_KEY;

export const stripeConfigurado = () => Boolean(CLAVE);

export const stripe = new Stripe(`${CLAVE}`, { apiVersion: "2022-11-15" });

/** Estados en los que la suscripción todavía puede cobrar algo. */
const VIVAS: Stripe.Subscription.Status[] = [
  "active",
  "trialing",
  "past_due",
  "unpaid",
  "incomplete",
];

/**
 * Los clientes de Stripe de un usuario.
 *
 * Se juntan los dos caminos en vez de quedarse con el primero que dé algo, y
 * esto importa justo en el borrado. La API de búsqueda tarda cerca de un
 * minuto en indexar un cliente nuevo: si se buscara solo por `metadata` y el
 * cliente se acabara de crear, la búsqueda devolvería vacío, el borrado diría
 * "no tenía nada en Stripe" y la suscripción seguiría cobrando a una cuenta
 * que ya no existe. Nadie se daría cuenta hasta el cargo del mes siguiente.
 *
 * El listado por correo no pasa por el índice, así que tapa ese hueco. Y la
 * búsqueda por uid tapa el del correo distinto entre Firebase y Stripe. Hacen
 * falta los dos.
 */
export async function clientesDelUsuario(
  uid: string,
  correo: string
): Promise<Stripe.Customer[]> {
  const porId = new Map<string, Stripe.Customer>();

  try {
    const r = await stripe.customers.search({
      query: `metadata['firebaseUid']:'${uid}'`,
      limit: 20,
    });
    for (const c of r.data) porId.set(c.id, c);
  } catch (err) {
    console.warn("Búsqueda por metadata no disponible:", err);
  }

  if (correo) {
    try {
      const r = await stripe.customers.list({ email: correo, limit: 20 });
      for (const c of r.data) porId.set(c.id, c);
    } catch (err) {
      console.warn("Listado por correo falló:", err);
    }
  }

  return [...porId.values()];
}

export type ResumenStripe = {
  clientes: string[];
  /** Suscripciones que todavía pueden cobrar. */
  suscripcionesVivas: number;
  estadoSuscripcion: string | null;
  /** Milisegundos; cuándo vuelve a cobrar, o hasta cuándo queda pagado. */
  proximoCobro: number | null;
  /** Cobrado y no devuelto, en la unidad menor de la moneda (centavos). */
  totalCobrado: number;
  totalDevuelto: number;
  moneda: string | null;
  cobros: number;
};

/**
 * Qué pagó este usuario, para pintarlo en la tabla.
 *
 * Solo cuenta cobros con `status: "succeeded"`: los fallidos y los pendientes
 * no son dinero cobrado y sumarlos daría una cifra que no cuadra con el panel
 * de Stripe.
 */
export async function resumenDeStripe(
  uid: string,
  correo: string
): Promise<ResumenStripe> {
  const clientes = await clientesDelUsuario(uid, correo);

  const vacio: ResumenStripe = {
    clientes: [],
    suscripcionesVivas: 0,
    estadoSuscripcion: null,
    proximoCobro: null,
    totalCobrado: 0,
    totalDevuelto: 0,
    moneda: null,
    cobros: 0,
  };
  if (clientes.length === 0) return vacio;

  const salida: ResumenStripe = { ...vacio, clientes: clientes.map((c) => c.id) };

  for (const cliente of clientes) {
    const subs = await stripe.subscriptions.list({
      customer: cliente.id,
      status: "all",
      limit: 100,
    });
    for (const s of subs.data) {
      if (!VIVAS.includes(s.status)) continue;
      salida.suscripcionesVivas++;
      salida.estadoSuscripcion = s.cancel_at_period_end
        ? `${s.status} (cancelada al final del periodo)`
        : s.status;
      const fin = (s.current_period_end ?? 0) * 1000;
      salida.proximoCobro = Math.max(salida.proximoCobro ?? 0, fin) || null;
    }

    const cobros = await stripe.charges.list({ customer: cliente.id, limit: 100 });
    for (const c of cobros.data) {
      if (c.status !== "succeeded") continue;
      salida.cobros++;
      salida.totalCobrado += c.amount;
      salida.totalDevuelto += c.amount_refunded ?? 0;
      salida.moneda = salida.moneda ?? c.currency;
    }
  }

  return salida;
}

export type PasoStripe = {
  suscripcionesCanceladas: number;
  clientesBorrados: number;
  devoluciones: { cobro: string; monto: number; ok: boolean; motivo?: string }[];
  /** Cobrado y no devuelto que queda en pie. Informativo, no se puede borrar. */
  cobrosQueQuedan: number;
  aviso?: string;
};

/**
 * Corta Stripe para este usuario. Si `reembolsar`, además devuelve el dinero.
 *
 * El orden es a propósito: primero cancelar, luego devolver, y borrar el
 * cliente al final. Si se borrara el cliente de entrada, Stripe cancelaría
 * sus suscripciones solo —no se perdería plata—, pero los cobros quedarían
 * colgados de un cliente borrado y listarlos para devolverlos se vuelve
 * incómodo. Cancelando primero, cada paso siguiente trabaja sobre algo que
 * todavía se puede consultar.
 *
 * No lanza: devuelve lo que consiguió hacer y un aviso si algo quedó a medias.
 * El endpoint que lo llama necesita seguir con Firestore y Storage aunque
 * Stripe falle, y luego decirle al admin exactamente qué quedó pendiente.
 */
export async function cortarStripe(
  uid: string,
  correo: string,
  reembolsar: boolean
): Promise<PasoStripe> {
  const paso: PasoStripe = {
    suscripcionesCanceladas: 0,
    clientesBorrados: 0,
    devoluciones: [],
    cobrosQueQuedan: 0,
  };

  let clientes: Stripe.Customer[] = [];
  try {
    clientes = await clientesDelUsuario(uid, correo);
  } catch (err) {
    paso.aviso = "No se pudieron consultar los clientes de Stripe.";
    console.error("Stripe: fallo al buscar clientes de", uid, err);
    return paso;
  }

  for (const cliente of clientes) {
    /* 1. Cancelar ya, no al final del periodo. */
    try {
      const subs = await stripe.subscriptions.list({
        customer: cliente.id,
        status: "all",
        limit: 100,
      });
      for (const s of subs.data) {
        if (!VIVAS.includes(s.status)) continue;
        await stripe.subscriptions.cancel(s.id);
        paso.suscripcionesCanceladas++;
      }
    } catch (err) {
      paso.aviso = `No se pudo cancelar la suscripción de ${cliente.id}. Revísalo a mano en Stripe antes de dar el borrado por bueno.`;
      console.error("Stripe: fallo al cancelar de", cliente.id, err);
    }

    /* 2. Devoluciones, solo si se pidieron. */
    let cobros: Stripe.Charge[] = [];
    try {
      const r = await stripe.charges.list({ customer: cliente.id, limit: 100 });
      cobros = r.data;
    } catch (err) {
      console.error("Stripe: no se pudieron listar los cobros de", cliente.id, err);
    }

    for (const c of cobros) {
      if (c.status !== "succeeded") continue;
      const sinDevolver = c.amount - (c.amount_refunded ?? 0);
      if (sinDevolver <= 0) continue;

      if (!reembolsar) {
        paso.cobrosQueQuedan += sinDevolver;
        continue;
      }

      try {
        await stripe.refunds.create({ charge: c.id, amount: sinDevolver });
        paso.devoluciones.push({ cobro: c.id, monto: sinDevolver, ok: true });
      } catch (err: any) {
        /* Stripe rechaza devoluciones de cobros muy antiguos o ya disputados.
           Se anota por cobro en vez de abortar: el admin necesita saber
           cuáles sí salieron. */
        paso.cobrosQueQuedan += sinDevolver;
        paso.devoluciones.push({
          cobro: c.id,
          monto: sinDevolver,
          ok: false,
          motivo: err?.message || "Stripe rechazó la devolución",
        });
        console.error("Stripe: no se pudo devolver", c.id, err);
      }
    }

    /* 3. Borrar el cliente. */
    try {
      await stripe.customers.del(cliente.id);
      paso.clientesBorrados++;
    } catch (err) {
      paso.aviso = `No se pudo borrar el cliente ${cliente.id} de Stripe.`;
      console.error("Stripe: fallo al borrar el cliente", cliente.id, err);
    }
  }

  return paso;
}
