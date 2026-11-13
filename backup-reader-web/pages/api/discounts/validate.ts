/**
 * Valida un código de descuento y devuelve cuánto se pagaría con él.
 *
 * Lo usa el botón "Aplicar" del pago, antes de cobrar nada. No mueve dinero
 * ni crea nada en Stripe: solo lee el código y el precio y hace la cuenta.
 *
 * ESTO NO ES LA VALIDACIÓN DEFINITIVA
 * -----------------------------------
 * Existe para que la pantalla no prometa un descuento que Stripe va a
 * rechazar un segundo después. El endpoint que crea la suscripción recibe el
 * código otra vez y lo vuelve a resolver con el mismo `resolverCodigo`, sin
 * fiarse de que aquí haya salido bien: entre una llamada y la otra el código
 * puede agotarse, vencer o desactivarse.
 */

import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";

import { importeDelPrecio, resolverCodigo } from "../../../lib/descuentos-stripe";

/* Solo `STRIPE_SECRET_KEY`. El respaldo `NEXT_PUBLIC_STRIPE_KEYS` se quitó: ese
   nombre es peligroso, porque cualquier día alguien la referencia desde un
   componente y el prefijo NEXT_PUBLIC_ mete la clave secreta en el bundle que
   descarga el navegador. */
const CLAVE = process.env.STRIPE_SECRET_KEY;

const stripe = new Stripe(`${CLAVE}`, { apiVersion: "2022-11-15" });

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "method-not-allowed" });
  }

  if (!CLAVE) {
    console.error("Stripe sin configurar: falta STRIPE_SECRET_KEY.");
    return res.status(500).json({ ok: false, error: "stripe-sin-configurar" });
  }

  const { code, priceId } = req.body ?? {};

  if (typeof code !== "string" || !code.trim()) {
    return res.status(400).json({ ok: false, motivo: "Escribe un código." });
  }
  if (typeof priceId !== "string" || !priceId.trim()) {
    return res.status(400).json({ ok: false, error: "sin-precio" });
  }

  try {
    const precio = await importeDelPrecio(stripe, priceId);
    if (!precio) {
      return res.status(400).json({ ok: false, error: "precio-no-soportado" });
    }

    const r = await resolverCodigo(stripe, code, precio.centavos, precio.moneda);

    if (!r.vale) {
      /* 200, no 400: el código no sirve, pero la petición estaba bien hecha.
         Un 400 haría que el navegador lo tratara como un fallo de la
         aplicación en vez de enseñar el motivo al usuario. */
      return res.status(200).json({ ok: false, motivo: r.motivo });
    }

    return res.status(200).json({
      ok: true,
      codigo: r.codigo,
      moneda: precio.moneda,
      precioCentavos: precio.centavos,
      totalCentavos: r.rebaja.totalCentavos,
      ahorroCentavos: r.rebaja.ahorroCentavos,
      gratisHoy: r.rebaja.gratisHoy,
      descripcion: r.descripcion,
      claveDescripcion: r.claveDescripcion,
      cantidad: r.cantidad,
      meses: r.meses,
      aviso: r.aviso,
    });
  } catch (error: any) {
    /* Un priceId que no existe es un fallo de la aplicación, no del usuario:
       se distingue para que el mensaje en pantalla no culpe al código. */
    if (error?.code === "resource_missing") {
      console.error("Price no encontrado al validar un código:", priceId, error?.message);
      return res.status(400).json({ ok: false, error: "precio-no-encontrado" });
    }
    console.error("Error al validar el código de descuento:", error);
    return res.status(500).json({ ok: false, error: "fallo-en-stripe" });
  }
}
