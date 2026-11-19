/**
 * Cuándo se habla: horas, días de la semana y meses.
 *
 * TRES MEDIDAS, PORQUE DICEN COSAS DISTINTAS
 * ------------------------------------------
 * Cada casilla lleva mensajes, palabras y notas de voz. Un mes de cuarenta
 * mensajes de una palabra y otro de cuarenta parrafadas no son el mismo mes,
 * y quien manda audios casi no aparece si solo se cuentan palabras. Ajustes
 * decide cuál se pinta; el cálculo trae las tres para que cambiar de vista no
 * obligue a recalcular el chat entero.
 *
 * LAS HORAS SON LAS DEL TELÉFONO QUE EXPORTÓ
 * ------------------------------------------
 * El export no dice en qué huso estaba cada uno. Se usan los números tal cual
 * venían (ver `fechaHora.ts`), y la interfaz lo avisa. Para un mapa de horas
 * es lo correcto: lo que interesa es si alguien escribe de madrugada, y eso
 * es de madrugada donde estaba, no donde está quien lo lee ahora.
 */

import type { Mensaje } from "./tipos";

export type Casilla = { mensajes: number; palabras: number; notasDeVoz: number };

export type Actividad = {
  /** 24 casillas, de las 00 a las 23. */
  porHora: Casilla[];
  /** 7 casillas, de lunes a domingo. */
  porDiaDeLaSemana: Casilla[];
  /** Meses con actividad, en orden, con clave «aaaa-mm». */
  porMes: Array<{ clave: string; anio: number; mes: number } & Casilla>;
  /** Las 24 × 7 casillas del mapa semanal: `[diaDeLaSemana][hora]`. */
  mapaSemanal: Casilla[][];
  /**
   * El mismo mapa en cubos de cuatro horas: `[diaDeLaSemana][cubo]`, 7 × 6.
   *
   * POR QUÉ NO SE PINTAN LAS 24 HORAS
   * ---------------------------------
   * 168 celdas en una pantalla de móvil salen a tres píxeles cada una: se ve
   * una nube de grises y no se lee nada. Además, con un chat normal la
   * mayoría de esas celdas tienen cero o un mensaje, así que el dibujo
   * enseñaría sobre todo ruido. En cubos de cuatro horas cada celda tiene
   * bastantes mensajes detrás y la franja en la que se habla se ve de un
   * vistazo, que es la pregunta real.
   */
  mapaPorCubos: Casilla[][];
  /** La celda con más actividad del mapa por cubos. */
  puntaSemanal: { dia: number; cubo: number } | null;
  /**
   * Días distintos con al menos un mensaje.
   *
   * El mapa de horas necesita días repartidos, no mensajes: tres días con
   * mil mensajes cada uno dibujan tres franjas oscuras y seis vacías, y eso
   * no es el horario de nadie, es el horario de esos tres días.
   */
  diasConMensajes: number;
  total: Casilla;
};

/** Cuántas horas entran en cada cubo del mapa. */
export const HORAS_POR_CUBO = 4;
/** Cuántos cubos tiene el día. */
export const CUBOS = 24 / HORAS_POR_CUBO;

const vacia = (): Casilla => ({ mensajes: 0, palabras: 0, notasDeVoz: 0 });
const repetir = (n: number) => Array.from({ length: n }, vacia);

function sumar(casilla: Casilla, m: Mensaje) {
  casilla.mensajes++;
  casilla.palabras += m.palabras;
  if (m.tipo === "audio") casilla.notasDeVoz++;
}

/** `getDay()` da 0 para domingo; aquí la semana empieza en lunes. */
const indiceDeDia = (fecha: Date) => (fecha.getDay() + 6) % 7;

/** Reparte los mensajes por hora, día de la semana y mes. */
export function actividad(mensajes: Mensaje[]): Actividad {
  const porHora = repetir(24);
  const porDiaDeLaSemana = repetir(7);
  const mapaSemanal = Array.from({ length: 7 }, () => repetir(24));
  const mapaPorCubos = Array.from({ length: 7 }, () => repetir(CUBOS));
  const meses = new Map<string, { clave: string; anio: number; mes: number } & Casilla>();
  const dias = new Set<string>();
  const total = vacia();

  for (const m of mensajes) {
    if (!m.fecha) continue;

    const hora = m.fecha.getHours();
    const dia = indiceDeDia(m.fecha);
    const anio = m.fecha.getFullYear();
    const mes = m.fecha.getMonth() + 1;
    const clave = `${anio}-${String(mes).padStart(2, "0")}`;

    let casillaMes = meses.get(clave);
    if (!casillaMes) {
      casillaMes = { clave, anio, mes, ...vacia() };
      meses.set(clave, casillaMes);
    }

    dias.add(`${clave}-${m.fecha.getDate()}`);

    sumar(porHora[hora], m);
    sumar(porDiaDeLaSemana[dia], m);
    sumar(mapaSemanal[dia][hora], m);
    sumar(mapaPorCubos[dia][Math.floor(hora / HORAS_POR_CUBO)], m);
    sumar(casillaMes, m);
    sumar(total, m);
  }

  /* La punta se busca sobre los cubos y no sobre las 24 horas: en un chat
     mediano, la hora más activa suele ganar por tres mensajes de diferencia,
     y decir «sobre todo a las 21:00» con esa ventaja es inventarse una
     precisión que el dato no tiene. */
  let puntaSemanal: Actividad["puntaSemanal"] = null;
  let mejor = 0;
  for (let d = 0; d < 7; d++) {
    for (let c = 0; c < CUBOS; c++) {
      if (mapaPorCubos[d][c].mensajes > mejor) {
        mejor = mapaPorCubos[d][c].mensajes;
        puntaSemanal = { dia: d, cubo: c };
      }
    }
  }

  return {
    porHora,
    porDiaDeLaSemana,
    porMes: [...meses.values()].sort((a, b) => a.clave.localeCompare(b.clave)),
    mapaSemanal,
    mapaPorCubos,
    puntaSemanal,
    diasConMensajes: dias.size,
    total,
  };
}
