/**
 * Si esta copia de la aplicación es la de verdad o una preview.
 *
 * EL PROBLEMA
 * -----------
 * Cada vez que se empuja una rama, Vercel publica una preview en una URL
 * pública, con el mismo código que producción. Eso trae dos cosas que no se
 * ven hasta que ya pasaron:
 *
 * 1. GOOGLE LAS INDEXA. Una preview puede acabar en los resultados de
 *    búsqueda compitiendo con el sitio real, y quien entre por ahí se crea una
 *    cuenta en una copia que mañana ya no existe.
 * 2. LAS PRUEBAS SE CUENTAN COMO VISITAS. Google Tag Manager y el aviso de
 *    cookies cargan igual en la preview, así que cada rato probando engorda
 *    las cifras del sitio y deja de saberse cuánta gente entró de verdad.
 *
 * NO HAY QUE CONFIGURAR NADA
 * --------------------------
 * `NEXT_PUBLIC_VERCEL_ENV` la pone Vercel sola en cada despliegue, y vale
 * "production", "preview" o "development". Así esto funciona en cuanto se
 * empuja una rama, sin acordarse de añadir variables en ningún panel.
 * `NEXT_PUBLIC_ENTORNO` queda como salida de emergencia para forzarlo a mano.
 *
 * SIN NINGUNA DE LAS DOS, PRODUCCIÓN
 * ----------------------------------
 * A propósito: lo de fuera de Vercel (el `next dev` de siempre, o cualquier
 * otro sitio donde se sirva esto) se comporta exactamente como hasta ahora, y
 * lo que hay que acertar es marcar la preview. Si eso falla, cuesta una página
 * indexada de más; al revés habría apagado la medición del sitio real sin que
 * nadie se diera cuenta.
 */

const CRUDO = (
  process.env.NEXT_PUBLIC_ENTORNO ||
  process.env.NEXT_PUBLIC_VERCEL_ENV ||
  ""
)
  .trim()
  .toLowerCase();

/** Una preview de rama, o un entorno marcado a mano como no productivo. */
export const ES_PREVIEW = CRUDO === "preview" || CRUDO === "staging";

export const ES_PRODUCCION = !ES_PREVIEW;

/** En una preview no se indexa ni se mide: ver arriba. */
export const SE_INDEXA = ES_PRODUCCION;
export const SE_MIDE = ES_PRODUCCION;
