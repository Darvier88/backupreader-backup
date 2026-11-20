/**
 * Quién escribe más.
 *
 * TRES CIFRAS, NO UNA
 * -------------------
 * «Quién escribe más» tiene tres respuestas distintas y todas son ciertas a
 * la vez:
 *
 *   - mensajes: quién pulsa enviar más veces. Premia a quien escribe a
 *     ráfagas, aunque diga lo mismo en menos.
 *   - palabras: cuánto texto pone cada uno. Es lo que la gente quiere decir
 *     cuando dice «escribe más».
 *   - mediana por turno: cómo de largo escribe cada uno de costumbre, sin que
 *     una parrafada suelta mueva la cifra.
 *
 * Por eso se devuelven las tres y la interfaz enseña la de palabras arriba,
 * con las otras dos debajo. Dar solo una obligaría a elegir qué significa
 * «más», y la elección ya sería media opinión.
 *
 * LOS ADJUNTOS CUENTAN COMO MENSAJE Y NO COMO PALABRAS
 * ----------------------------------------------------
 * Lo decide `normalizar`. Quien manda cuarenta fotos y tres palabras tiene
 * muchos mensajes y pocas palabras, y las dos cosas se ven.
 */

import { medianaDePalabrasPorTurno, agruparEnTurnos } from "./turnos";
import type { Mensaje, Turno } from "./tipos";
import { compararReparto, type Comparacion } from "./umbrales";

export type VolumenDeAutor = {
  autor: string;
  mensajes: number;
  palabras: number;
  /** Palabras del turno típico: mediana, no media. */
  medianaPorTurno: number;
  /** Porcentaje de las palabras del chat. */
  porcentajePalabras: number;
  /** Porcentaje de los mensajes del chat. */
  porcentajeMensajes: number;
};

export type Volumen = {
  porAutor: VolumenDeAutor[];
  totalMensajes: number;
  totalPalabras: number;
  /** Quién escribe más palabras, o «parecido». Solo con dos personas. */
  masPalabras: Comparacion<string>;
  /** Quién manda más mensajes, o «parecido». Solo con dos personas. */
  masMensajes: Comparacion<string>;
};

const porcentaje = (parte: number, total: number) =>
  total > 0 ? Math.round((parte / total) * 1000) / 10 : 0;

/**
 * Cuánto escribe cada persona.
 *
 * `turnos` se puede pasar ya calculado para no repetir el trabajo; si no,
 * se calcula aquí.
 */
export function escribeMas(mensajes: Mensaje[], turnos?: Turno[]): Volumen {
  const lista = turnos ?? agruparEnTurnos(mensajes);
  const medianas = medianaDePalabrasPorTurno(lista);

  const cuentas = new Map<string, { mensajes: number; palabras: number }>();
  for (const m of mensajes) {
    const c = cuentas.get(m.autor) || { mensajes: 0, palabras: 0 };
    c.mensajes++;
    c.palabras += m.palabras;
    cuentas.set(m.autor, c);
  }

  let totalMensajes = 0;
  let totalPalabras = 0;
  for (const c of cuentas.values()) {
    totalMensajes += c.mensajes;
    totalPalabras += c.palabras;
  }

  const porAutor: VolumenDeAutor[] = [...cuentas.entries()]
    .map(([autor, c]) => ({
      autor,
      mensajes: c.mensajes,
      palabras: c.palabras,
      medianaPorTurno: medianas[autor] ?? 0,
      porcentajePalabras: porcentaje(c.palabras, totalPalabras),
      porcentajeMensajes: porcentaje(c.mensajes, totalMensajes),
    }))
    /* De más a menos palabras: es el orden en que se enseña. */
    .sort((a, b) => b.palabras - a.palabras || a.autor.localeCompare(b.autor));

  const sinVeredicto: Comparacion<string> = { mayor: null, parecido: true };
  if (porAutor.length !== 2) {
    return { porAutor, totalMensajes, totalPalabras, masPalabras: sinVeredicto, masMensajes: sinVeredicto };
  }

  const [a, b] = porAutor;
  return {
    porAutor,
    totalMensajes,
    totalPalabras,
    masPalabras: compararReparto(a.autor, a.palabras, b.autor, b.palabras),
    masMensajes: compararReparto(a.autor, a.mensajes, b.autor, b.mensajes),
  };
}
