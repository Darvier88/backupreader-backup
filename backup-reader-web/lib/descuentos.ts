/**
 * La aritmética de un código de descuento, y las razones para rechazarlo.
 *
 * Aparte del endpoint y sin importar Stripe, para que se pueda probar: son
 * funciones puras sobre números y objetos planos. Lo que se calcula aquí es
 * lo que el usuario ve ANTES de pagar; el importe que de verdad se cobra lo
 * calcula Stripe al crear la suscripción. Que las dos cuentas coincidan es
 * justo lo que estos tests comprueban, porque un resumen que promete 2,39 y
 * un cargo de 2,99 es una queja garantizada.
 *
 * Todo va en centavos (la unidad menor de la moneda), como Stripe.
 */

/** Lo que nos interesa de un cupón de Stripe. */
export type CuponComoSea = {
  percent_off?: number | null;
  amount_off?: number | null;
  currency?: string | null;
  duration?: "once" | "repeating" | "forever" | string;
  duration_in_months?: number | null;
  name?: string | null;
  valid?: boolean;
};

/** Lo que nos interesa de un código de promoción de Stripe. */
export type PromoComoSea = {
  code?: string;
  active?: boolean;
  coupon?: CuponComoSea;
  expires_at?: number | null;
  max_redemptions?: number | null;
  times_redeemed?: number;
  restrictions?: {
    first_time_transaction?: boolean;
    minimum_amount?: number | null;
    minimum_amount_currency?: string | null;
  };
};

export type Rebaja = {
  /** Lo que se paga hoy, en centavos. Nunca negativo. */
  totalCentavos: number;
  /** Lo que se ahorra hoy, en centavos. */
  ahorroCentavos: number;
  /** El primer cobro sale en cero: hay que tratarlo como caso aparte. */
  gratisHoy: boolean;
};

/**
 * Aplica un cupón a un importe.
 *
 * Dos detalles que no son obvios:
 *
 * - Se redondea al centavo con `Math.round` (medio centavo hacia arriba). Sin
 *   redondear, un 33% sobre 2,99 daría 2,0033 y el resumen mostraría un
 *   importe que no existe como dinero.
 *
 *   OJO CON ESTO: no he podido confirmar en la documentación de Stripe cómo
 *   redondea ELLA el medio centavo, así que esto es lo más razonable, no algo
 *   verificado. Y el caso existe de verdad: un 50% sobre 2,99 da 1,495, y un
 *   50% sobre 3,99 da 1,995. Si Stripe redondeara hacia abajo, el resumen
 *   diría 1,49 y el cargo sería 1,50 — un centavo, pero suficiente para una
 *   queja. Se comprueba en dos minutos en modo de prueba: crea un cupón del
 *   50%, aplícalo a una suscripción de 2,99 y mira el importe de la factura.
 *   Si no coincide, el único cambio es la dirección del redondeo en esta
 *   función y el test que la fija.
 * - Un `amount_off` mayor que el precio deja el total en cero, no en negativo.
 *   Stripe no devuelve dinero por un cupón demasiado grande, y un total
 *   negativo en pantalla sería absurdo.
 */
export function aplicarCupon(centavos: number, cupon: CuponComoSea): Rebaja {
  const base = Math.max(0, Math.round(centavos));

  let ahorro = 0;
  if (typeof cupon.percent_off === "number" && cupon.percent_off > 0) {
    ahorro = Math.round((base * cupon.percent_off) / 100);
  } else if (typeof cupon.amount_off === "number" && cupon.amount_off > 0) {
    ahorro = cupon.amount_off;
  }

  ahorro = Math.min(ahorro, base);
  const total = base - ahorro;

  return {
    totalCentavos: total,
    ahorroCentavos: ahorro,
    gratisHoy: total === 0 && base > 0,
  };
}

/**
 * Cuánto dura el descuento, en palabras.
 *
 * Importa decirlo: un cupón `once` rebaja solo el primer mes y al siguiente
 * se cobra el precio entero. Si el resumen solo dijera "20% de descuento", el
 * segundo recibo parecería un error de cobro.
 */
export function duracionEnPalabras(cupon: CuponComoSea): string {
  if (cupon.duration === "forever") return "mientras tengas la suscripción";
  if (cupon.duration === "once") return "solo en el primer mes";
  if (cupon.duration === "repeating") {
    const n = cupon.duration_in_months ?? 0;
    if (n === 1) return "solo en el primer mes";
    if (n > 1) return `durante los primeros ${n} meses`;
  }
  return "";
}

/**
 * Cuánto descuenta, como texto: "20%" o "1.50 USD".
 *
 * Es la única parte de la descripción que NO se traduce, porque son cifras.
 * Va aparte para poder metérsela a i18next como variable.
 */
export function cantidadEnPalabras(cupon: CuponComoSea, moneda: string): string {
  if (typeof cupon.percent_off === "number" && cupon.percent_off > 0) {
    return `${cupon.percent_off % 1 === 0 ? cupon.percent_off : cupon.percent_off.toFixed(2)}%`;
  }
  if (typeof cupon.amount_off === "number" && cupon.amount_off > 0) {
    return `${(cupon.amount_off / 100).toFixed(2)} ${moneda.toUpperCase()}`;
  }
  return "";
}

/**
 * La clave de i18n con la que el navegador arma la descripción.
 *
 * El servidor NO manda la frase ya montada para que se pueda traducir. En
 * inglés el orden cambia —"20% off, first month only"—, así que no vale con
 * traducir trozos y pegarlos: hace falta una frase entera por caso, con la
 * cifra como variable.
 */
export function claveDeDescripcion(cupon: CuponComoSea): string {
  if (cupon.duration === "forever") {
    return "{{cantidad}} de descuento, mientras tengas la suscripción";
  }
  if (cupon.duration === "once") {
    return "{{cantidad}} de descuento, solo en el primer mes";
  }
  if (cupon.duration === "repeating") {
    const n = cupon.duration_in_months ?? 0;
    if (n === 1) return "{{cantidad}} de descuento, solo en el primer mes";
    if (n > 1) return "{{cantidad}} de descuento, durante los primeros {{meses}} meses";
  }
  return "{{cantidad}} de descuento";
}

/**
 * El descuento en palabras, en español.
 *
 * Se sigue devolviendo como respaldo: si algún día llega un cupón con una
 * duración que `claveDeDescripcion` no contempla, el navegador enseña esto en
 * vez de una clave de i18n en crudo.
 */
export function descuentoEnPalabras(cupon: CuponComoSea, moneda: string): string {
  const cuanto = cantidadEnPalabras(cupon, moneda);
  if (!cuanto) return cupon.name || "Descuento aplicado";

  const dura = duracionEnPalabras(cupon);
  return dura ? `${cuanto} de descuento, ${dura}` : `${cuanto} de descuento`;
}

/**
 * ¿Hay alguna razón para rechazar este código? Devuelve el motivo, o null.
 *
 * Esto NO sustituye a la validación de Stripe, que vuelve a comprobarlo todo
 * al crear la suscripción y es la que manda. Sirve para no prometer en
 * pantalla un descuento que Stripe va a rechazar un segundo después, con el
 * usuario creyendo que va a pagar menos.
 *
 * Queda una restricción que aquí NO se puede comprobar:
 * `first_time_transaction`, que exige que el cliente no haya pagado nunca.
 * Depende del cliente de Stripe, y en este punto del flujo todavía no existe
 * —se crea al pulsar "Suscribirte"—. Esa la aplica Stripe al crear la
 * suscripción, y de ahí viene el aviso que se devuelve en `avisoDeRestriccion`.
 */
export function motivoDeRechazo(
  promo: PromoComoSea,
  centavos: number,
  moneda: string,
  ahoraMs: number = Date.now()
): string | null {
  if (!promo.code) return "Ese código no existe.";
  if (promo.active === false) return "Ese código ya no está activo.";
  if (promo.coupon?.valid === false) return "Ese código ya no es válido.";

  if (promo.expires_at && promo.expires_at * 1000 <= ahoraMs) {
    return "Ese código ya venció.";
  }

  if (
    typeof promo.max_redemptions === "number" &&
    (promo.times_redeemed ?? 0) >= promo.max_redemptions
  ) {
    return "Ese código ya se usó el máximo de veces.";
  }

  const r = promo.restrictions;
  if (r?.minimum_amount) {
    /* La moneda del mínimo tiene que ser la del precio; comparar 500 ARS con
       299 USD como si fueran el mismo número daría un rechazo —o un pase—
       falso. */
    const monedaMin = (r.minimum_amount_currency || moneda).toLowerCase();
    if (monedaMin !== moneda.toLowerCase()) {
      return "Ese código no se puede usar con esta moneda.";
    }
    if (centavos < r.minimum_amount) {
      const min = (r.minimum_amount / 100).toFixed(2);
      return `Ese código pide un importe mínimo de ${min} ${moneda.toUpperCase()}.`;
    }
  }

  const cupon = promo.coupon;
  if (!cupon) return "Ese código no tiene un descuento asociado.";

  /* Un cupón de importe fijo en otra moneda no se puede aplicar a este
     precio: Stripe lo rechaza, y restar 500 ARS a 299 USD no significa
     nada. */
  if (
    typeof cupon.amount_off === "number" &&
    cupon.amount_off > 0 &&
    cupon.currency &&
    cupon.currency.toLowerCase() !== moneda.toLowerCase()
  ) {
    return "Ese código no se puede usar con esta moneda.";
  }

  const sinDescuento =
    !(typeof cupon.percent_off === "number" && cupon.percent_off > 0) &&
    !(typeof cupon.amount_off === "number" && cupon.amount_off > 0);
  if (sinDescuento) return "Ese código no aplica ningún descuento.";

  return null;
}

/**
 * El aviso de que el código puede caerse al pagar, o null si no hay riesgo.
 *
 * `first_time_transaction` solo se puede comprobar con un cliente de Stripe
 * delante, y aquí todavía no hay. Mejor decirlo que dejar que el usuario se
 * lleve la sorpresa en el recibo.
 */
export function avisoDeRestriccion(promo: PromoComoSea): string | null {
  if (promo.restrictions?.first_time_transaction) {
    return "Este código es solo para la primera compra. Si ya pagaste antes con este correo, no se aplicará.";
  }
  return null;
}

/** Centavos a texto, para la pantalla. */
export function enDinero(centavos: number, moneda: string): string {
  return `${(centavos / 100).toFixed(2)} ${moneda.toUpperCase()}`;
}

/**
 * Normaliza lo que escribió el usuario.
 *
 * Stripe guarda los códigos en mayúsculas y los acepta sin distinguirlas al
 * canjearlos, pero el filtro `code` de la API de listado SÍ distingue. Sin
 * esto, escribir "verano24" no encontraría el código "VERANO24" y el usuario
 * vería "ese código no existe" teniendo uno bueno en la mano.
 */
export function normalizarCodigo(texto: string): string {
  return texto.trim().toUpperCase();
}
