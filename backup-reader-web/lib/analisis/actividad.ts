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
  total: Casilla;
};

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
  const meses = new Map<string, { clave: string; anio: number; mes: number } & Casilla>();
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

    sumar(porHora[hora], m);
    sumar(porDiaDeLaSemana[dia], m);
    sumar(mapaSemanal[dia][hora], m);
    sumar(casillaMes, m);
    sumar(total, m);
  }

  return {
    porHora,
    porDiaDeLaSemana,
    porMes: [...meses.values()].sort((a, b) => a.clave.localeCompare(b.clave)),
    mapaSemanal,
    total,
  };
}
