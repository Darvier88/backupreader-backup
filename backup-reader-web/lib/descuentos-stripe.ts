/**
 * Resolver un código de descuento contra Stripe.
 *
 * Lo comparten el endpoint que valida (el botón "Aplicar") y el que crea la
 * suscripción. Que sea el mismo código en los dos sitios es el punto: si cada
 * uno resolviera el código a su manera, la pantalla podría prometer un
 * descuento que el cobro no aplica, y al revés.
 *
 * Los dos trabajan con el TEXTO del código, no con el id del código de
 * promoción. Podría pasarse el id de una llamada a la otra y ahorrarse una
 * consulta, pero entonces el cobro dependería de un identificador de Stripe
 * que llega del navegador. Resolviendo el texto cada vez, lo único que el
 * usuario puede mandar es lo que escribió, y quien manda es Stripe.
 */

import type Stripe from "stripe";

import {
  aplicarCupon,
  avisoDeRestriccion,
  cantidadEnPalabras,
  claveDeDescripcion,
  descuentoEnPalabras,
  motivoDeRechazo,
  normalizarCodigo,
  type Rebaja,
} from "./descuentos";

export type CodigoResuelto =
  | { vale: false; motivo: string }
  | {
      vale: true;
      promotionCodeId: string;
      codigo: string;
      rebaja: Rebaja;
      /* En espanol, como respaldo si la clave no estuviera traducida. */
      descripcion: string;
      /* Las piezas con las que el navegador arma la frase traducida. El
         servidor no manda la frase montada porque en ingles el orden cambia. */
      claveDescripcion: string;
      cantidad: string;
      meses: number | null;
      aviso: string | null;
    };

/** Los códigos de Stripe no pasan de 200 caracteres. */
const LARGO_MAXIMO = 200;

/**
 * Busca el código y comprueba que se pueda usar con este importe.
 *
 * Devuelve el motivo en palabras cuando no vale, para poder enseñarlo tal
 * cual: el usuario necesita saber si el código venció, si se agotó o si no
 * llega al importe mínimo, no un "código inválido" que no dice nada.
 */
export async function resolverCodigo(
  stripe: Stripe,
  textoDelCodigo: string,
  centavos: number,
  moneda: string
): Promise<CodigoResuelto> {
  const codigo = normalizarCodigo(textoDelCodigo);

  if (!codigo) return { vale: false, motivo: "Escribe un código." };
  if (codigo.length > LARGO_MAXIMO) {
    return { vale: false, motivo: "Ese código no existe o ya no está activo." };
  }

  const encontrados = await stripe.promotionCodes.list({
    code: codigo,
    active: true,
    limit: 1,
    expand: ["data.coupon"],
  });

  const promo = encontrados.data[0];
  if (!promo) {
    /* Mismo mensaje para "no existe" y para "existe pero está desactivado":
       no hay por qué confirmarle a quien prueba códigos al azar cuáles
       existieron alguna vez. */
    return { vale: false, motivo: "Ese código no existe o ya no está activo." };
  }

  const motivo = motivoDeRechazo(promo as any, centavos, moneda);
  if (motivo) return { vale: false, motivo };

  return {
    vale: true,
    promotionCodeId: promo.id,
    codigo: promo.code,
    rebaja: aplicarCupon(centavos, promo.coupon as any),
    descripcion: descuentoEnPalabras(promo.coupon as any, moneda),
    claveDescripcion: claveDeDescripcion(promo.coupon as any),
    cantidad: cantidadEnPalabras(promo.coupon as any, moneda),
    meses: (promo.coupon as any)?.duration_in_months ?? null,
    aviso: avisoDeRestriccion(promo as any),
  };
}

/**
 * El importe y la moneda de un precio de Stripe.
 *
 * Se lee de Stripe y no de lo que mande el navegador. Si se fiara del precio
 * enviado, el descuento se calcularía sobre una cifra inventada y el resumen
 * mostraría un total que no es el que se va a cobrar.
 */
export async function importeDelPrecio(
  stripe: Stripe,
  priceId: string
): Promise<{ centavos: number; moneda: string } | null> {
  const precio = await stripe.prices.retrieve(priceId);
  if (typeof precio.unit_amount !== "number") {
    /* Un precio escalonado o por uso no tiene importe unitario y aquí no hay
       nada que descontar. Hoy todos los planes son de importe fijo; si dejan
       de serlo, esto lo dice en vez de calcular mal. */
    console.error("El precio", priceId, "no tiene unit_amount.");
    return null;
  }
  return { centavos: precio.unit_amount, moneda: precio.currency };
}
