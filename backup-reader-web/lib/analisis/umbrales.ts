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

/** Mensajes contables mínimos para enseñar cualquier métrica del chat. */
export const MIN_MENSAJES = 100;

/** Conversaciones mínimas para hablar de quién empieza. */
export const MIN_CONVERSACIONES = 20;

/** Respuestas mínimas para hablar de tiempos de respuesta. */
export const MIN_RESPUESTAS = 30;

/**
 * Margen para considerar dos repartos el mismo: diez puntos.
 *
 * Es decir, de 45/55 para dentro es «parecido». Sale de que lo que la gente
 * nota en una conversación es «uno de los dos escribe bastante más», y eso
 * empieza a notarse alrededor de 60/40.
 */
export const MARGEN_PARECIDO = 10;

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
