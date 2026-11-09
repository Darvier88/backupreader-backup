/**
 * El precio de Stripe que corresponde a cada plan.
 *
 * Esta tabla ya existía, pero escrita a mano dentro de una función anidada de
 * `PaymentCard`, en forma de `if (price == 2.99)`. Se saca aquí porque ahora
 * hacen falta en dos momentos distintos —al validar un código de descuento y
 * al cobrar— y tener la misma cadena copiada en dos sitios es la forma segura
 * de que algún día dejen de coincidir.
 *
 * ESTO SIGUE SIENDO FRÁGIL, Y CONVIENE SABERLO
 * --------------------------------------------
 * El navegador es quien elige el precio y quien se lo manda al servidor. O
 * sea que alguien puede pedir el plan caro y mandar el id del precio barato.
 * El arreglo de verdad es que el servidor traduzca el plan a precio y no
 * acepte un precio del cliente, pero eso cambia el contrato del endpoint que
 * cobra, y se decidió no tocar el camino del dinero en el mismo cambio que
 * introduce los descuentos. Queda escrito aquí para que no se pierda.
 */

/** Los precios viven en Stripe; esto solo dice cuál va con cuál. */
const POR_IMPORTE: Array<{ importe: number; price: string }> = [
  { importe: 2.99, price: "price_1NM0cTF3VaqMsYUWuhKmsf4b" },
  { importe: 3.99, price: "price_1NM0jtF3VaqMsYUWZfyUP0Om" },
];

/** El de más arriba; es el que se usaba en el `else` del código original. */
const POR_DEFECTO = "price_1NM0kNF3VaqMsYUWT7Mj25xr";

/**
 * El id del precio de Stripe para un importe de plan.
 *
 * Se compara en centavos. Con decimales, `2.99 !== 2.99` puede ser cierto
 * según de dónde venga el número, y una comparación que falla aquí manda al
 * usuario al plan equivocado sin avisar.
 */
export function precioDeStripe(importe: number | undefined | null): string {
  if (typeof importe !== "number") return POR_DEFECTO;
  const centavos = Math.round(importe * 100);
  const hallado = POR_IMPORTE.find((p) => Math.round(p.importe * 100) === centavos);
  return hallado ? hallado.price : POR_DEFECTO;
}
