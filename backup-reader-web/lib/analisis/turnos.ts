/**
 * Turnos: mensajes seguidos de la misma persona, juntos.
 *
 * POR QUÉ
 * -------
 * Hay quien escribe «oye», «¿tienes un momento?», «es por lo de ayer» y hay
 * quien escribe las tres cosas en un mensaje. Contando mensajes, el primero
 * parece hablar el triple. Para el volumen eso da igual —las palabras son
 * las mismas—, pero para el ritmo no: si cada uno de esos tres mensajes
 * contara como un intento de conversación, quien escribe a ráfagas saldría
 * iniciando y respondiendo mucho más de lo que hace.
 *
 * Así que todo lo que mide ritmo cuenta turnos: quién empieza una
 * conversación y cuánto tarda el otro en contestar.
 *
 * SIN LÍMITE DE TIEMPO DENTRO DEL TURNO
 * -------------------------------------
 * Dos mensajes seguidos de la misma persona son el mismo turno aunque pasen
 * horas: mientras el otro no haya dicho nada, sigue siendo el mismo que
 * habla. Quien decide dónde empieza una conversación nueva es `iniciaMas`,
 * con su umbral de silencio, y para eso le hace falta ver el hueco entero.
 */

import type { Mensaje, Turno } from "./tipos";

/**
 * Agrupa mensajes consecutivos del mismo autor.
 *
 * Espera mensajes ya filtrados por `contables()`: con fecha, sin sistema y
 * sin eliminados. Si llega alguno sin fecha, se descarta en vez de romper el
 * orden del resto.
 */
export function agruparEnTurnos(mensajes: Mensaje[]): Turno[] {
  const turnos: Turno[] = [];

  for (const m of mensajes) {
    if (!m.fecha) continue;

    const ultimo = turnos[turnos.length - 1];
    if (ultimo && ultimo.autor === m.autor) {
      ultimo.mensajes.push(m);
      ultimo.fin = m.fecha;
      ultimo.palabras += m.palabras;
      continue;
    }

    turnos.push({
      autor: m.autor,
      mensajes: [m],
      inicio: m.fecha,
      fin: m.fecha,
      palabras: m.palabras,
    });
  }

  return turnos;
}

/** La mediana de una lista de números. Vacía: `null`. */
export function mediana(valores: number[]): number | null {
  if (valores.length === 0) return null;
  const orden = [...valores].sort((a, b) => a - b);
  const medio = Math.floor(orden.length / 2);
  return orden.length % 2 === 0 ? (orden[medio - 1] + orden[medio]) / 2 : orden[medio];
}

/**
 * Mediana de palabras por turno, por autor.
 *
 * Mediana y no media: una sola parrafada de mil palabras mueve la media de
 * alguien que normalmente escribe diez, y lo que se quiere enseñar es cómo
 * escribe de costumbre.
 */
export function medianaDePalabrasPorTurno(turnos: Turno[]): Record<string, number> {
  const porAutor = new Map<string, number[]>();
  for (const t of turnos) {
    const lista = porAutor.get(t.autor) || [];
    lista.push(t.palabras);
    porAutor.set(t.autor, lista);
  }

  const salida: Record<string, number> = {};
  for (const [autor, lista] of porAutor) {
    const m = mediana(lista);
    if (m !== null) salida[autor] = m;
  }
  return salida;
}
