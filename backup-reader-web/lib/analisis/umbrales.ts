/**
 * Cuándo hay datos suficientes para decir algo, y cuándo dos cifras son
 * la misma cifra.
 *
 * POR QUÉ HAY MÍNIMOS
 * -------------------
 * Con veinte mensajes, «Ana escribe el 70 %» significa que Ana mandó catorce
 * y la otra persona seis, una tarde. Enseñarlo como un rasgo de la relación
 * es inventarse algo. Por debajo de estos mínimos la interfaz dice que aún no
 * hay bastante conversación, y no enseña la métrica.
 *
 * POR QUÉ EXISTE «PARECIDO»
 * -------------------------
 * 52 % contra 48 % no es «Ana escribe más»: es un empate con ruido. Sin un
 * margen, cualquier diferencia se convierte en un veredicto, y el veredicto
 * se lee como un reproche. Cuando la diferencia cabe dentro del margen, la
 * respuesta es «parecido», que además suele ser la verdad.
 */

/**
 * Los mínimos van POR MÉTRICA, no para el panel entero.
 *
 * Antes bastaba con no llegar a cien mensajes para que no se enseñara nada.
 * Pero contar mensajes y palabras se puede hacer con cuarenta: lo que no se
 * puede es hablar de ritmos. Cada cifra pide lo suyo, y lo que no llega
 * dice qué le falta en vez de desaparecer.
 */

/** Mensajes mínimos para comparar cuánto escribe cada uno. */
export const MIN_MENSAJES = 100;

/** Conversaciones mínimas para hablar de quién empieza. */
export const MIN_CONVERSACIONES = 10;

/** Respuestas mínimas POR PERSONA para hablar de tiempos de respuesta. */
export const MIN_RESPUESTAS = 30;

/** Días distintos con mensajes para que el mapa de horas diga algo. */
export const MIN_DIAS = 14;

/** Meses enteros para hablar de tendencia. */
export const MIN_MESES = 2;

/**
 * Margen para considerar dos repartos el mismo: cinco puntos.
 *
 * Es decir, de 47,5/52,5 para dentro es «parecido». Empecé con diez, que
 * es donde la diferencia se nota leyendo el chat, pero diez puntos se come
 * casos como 56/44 que sí son una diferencia real y que la gente reconoce
 * al ver las cifras. Con cinco, el empate sigue siendo empate y lo demás se
 * nombra con el reparto delante para que cada cual juzgue.
 */
export const MARGEN_PARECIDO = 5;

/** Quién sale por delante, o `null` si la diferencia cabe en el margen. */
export type Comparacion<T> = { mayor: T | null; parecido: boolean };

/**
 * Compara dos cantidades como reparto de un total.
 *
 * `margen` va en puntos porcentuales sobre el total de las dos.
 */
export function compararReparto<T>(
  claveA: T,
  valorA: number,
  claveB: T,
  valorB: number,
  margen = MARGEN_PARECIDO
): Comparacion<T> {
  const total = valorA + valorB;
  if (total <= 0) return { mayor: null, parecido: true };

  const diferencia = (Math.abs(valorA - valorB) / total) * 100;
  if (diferencia < margen) return { mayor: null, parecido: true };

  return { mayor: valorA > valorB ? claveA : claveB, parecido: false };
}

/**
 * Compara dos duraciones (o dos medianas cualesquiera).
 *
 * Aquí el reparto no sirve: entre 2 y 3 minutos el reparto da 20 puntos, pero
 * un minuto de diferencia al contestar no lo nota nadie. Se usa la proporción
 * entre las dos y un suelo absoluto por debajo del cual todo es lo mismo.
 */
export function compararDuraciones<T>(
  claveA: T,
  valorA: number,
  claveB: T,
  valorB: number,
  opciones: { proporcion?: number; suelo?: number } = {}
): Comparacion<T> {
  const proporcion = opciones.proporcion ?? 1.5;
  const suelo = opciones.suelo ?? 0;

  if (!isFinite(valorA) || !isFinite(valorB)) return { mayor: null, parecido: true };
  if (Math.abs(valorA - valorB) <= suelo) return { mayor: null, parecido: true };

  const mayor = Math.max(valorA, valorB);
  const menor = Math.min(valorA, valorB);
  if (menor <= 0) return { mayor: valorA > valorB ? claveA : claveB, parecido: false };
  if (mayor / menor < proporcion) return { mayor: null, parecido: true };

  return { mayor: valorA > valorB ? claveA : claveB, parecido: false };
}
