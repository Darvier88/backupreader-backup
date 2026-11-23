/**
 * La marca de tiempo completa de cada mensaje, para el análisis.
 *
 * POR QUÉ NO SE REUSA `aFecha()` DE `fechas-de-chat.ts`
 * ----------------------------------------------------
 * Esa función resuelve el 3/4/26 con el idioma de QUIEN LEE, y hace bien:
 * allí solo decide cómo se escribe una etiqueta («3 abr» o «4 mar») y
 * equivocarse cuesta una palabra mal puesta. Aquí decide en qué mes cae un
 * mensaje, y equivocarse mueve meses enteros de sitio en «mensajes por mes»
 * y en las tendencias. Además tira la hora, que es justo lo que hace falta
 * para los tiempos de respuesta y el mapa de horas.
 *
 * Así que esto deduce el formato POR CHAT, mirando el export entero, y no
 * toca nada de lo que ya existe.
 *
 * CÓMO SE DEDUCE EL FORMATO
 * -------------------------
 * Un export es coherente consigo mismo: lo escribió un teléfono con una
 * configuración. Basta con encontrar una fecha donde un componente pase de
 * 12 para saber cuál es el día. «13/4/26» solo puede ser día primero;
 * «4/13/26», mes primero. Con un chat de unos meses aparece casi seguro.
 *
 * Si no aparece ninguna —un chat corto que vive entero en los doce primeros
 * días del mes—, se usa el idioma de quien lee como último recurso, y el
 * resultado se marca como no seguro para que la interfaz pueda avisar.
 *
 * LAS HORAS SE DEJAN COMO VIENEN
 * ------------------------------
 * El export trae la hora del teléfono que lo generó, sin huso. Convertirla
 * exigiría saber dónde estaba esa persona en cada momento del historial, que
 * es justo lo que no se puede saber. Se construye un `Date` en la hora local
 * de quien mira, que es lo mismo que decir «estos números, tal cual»; la
 * interfaz avisa de que son las del teléfono de quien exportó.
 */

import { partirFechaHora } from "../fechas-de-chat";

/** Lo que se dedujo del formato de fecha de un chat. */
export type FormatoFecha = {
  /** El primer número de «3/4/26» es el día. */
  diaPrimero: boolean;
  /** Se encontró una fecha que lo demuestra (algún componente > 12). */
  seguro: boolean;
};

/**
 * Deduce si las fechas de este chat llevan el día delante.
 *
 * `diaPrimeroPorDefecto` es el respaldo para cuando el chat no tiene ninguna
 * fecha que lo demuestre; quien llama le pasa lo que diga el idioma del
 * lector (`idiomaConDiaPrimero`).
 */
export function deducirFormato(
  filas: string[][],
  diaPrimeroPorDefecto = true
): FormatoFecha {
  let dia = 0;
  let mes = 0;
  /* Fechas con el año delante («2026-03-01»): no hay nada que deducir. */
  let conAno = 0;
  /* Fechas con barras donde los dos números caben en un mes, que son las
     únicas que obligan a preguntar. */
  let ambiguas = 0;

  for (const fila of filas) {
    const { fecha } = partirFechaHora(fila[0]);
    if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      conAno++;
      continue;
    }
    const p = fecha.match(/^(\d{1,2})\/(\d{1,2})\/\d{2,4}$/);
    if (!p) continue;
    const a = Number(p[1]);
    const b = Number(p[2]);
    if (a > 12 && b <= 12) dia++;
    else if (b > 12 && a <= 12) mes++;
    else ambiguas++;
  }

  if (dia === 0 && mes === 0) {
    /* Un chat con el año delante y ninguna fecha ambigua está resuelto, y
       preguntar sería absurdo: es lo que trae Instagram, y así el análisis no
       se queda esperando una respuesta que no hace falta. `diaPrimero` no se
       llega a usar para estas fechas; queda el respaldo por si el chat
       mezclara formatos. */
    if (conAno > 0 && ambiguas === 0) {
      return { diaPrimero: diaPrimeroPorDefecto, seguro: true };
    }
    return { diaPrimero: diaPrimeroPorDefecto, seguro: false };
  }

  /* Un export no debería contradecirse, pero si lo hace (dos teléfonos
     pegados en un archivo, alguien editando a mano) gana lo que más veces
     aparece, y deja de considerarse seguro. */
  if (dia > 0 && mes > 0) {
    return { diaPrimero: dia >= mes, seguro: false };
  }

  return { diaPrimero: dia > 0, seguro: true };
}

/** Pasa «8:10 PM», «20:10» o «8:10:33» a minutos y segundos del día. */
function partirHora(hora: string): { h: number; m: number; s: number } | null {
  const p = hora.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp])?\.?\s?[Mm]?\.?$/);
  if (!p) return null;

  let h = Number(p[1]);
  const m = Number(p[2]);
  const s = p[3] ? Number(p[3]) : 0;
  const sufijo = p[4] ? p[4].toLowerCase() : "";

  if (sufijo === "p" && h < 12) h += 12;
  if (sufijo === "a" && h === 12) h = 0;

  if (h > 23 || m > 59 || s > 59) return null;
  return { h, m, s };
}

/**
 * La marca de tiempo de una fila, o `null` si no se entiende.
 *
 * Sin hora devuelve el día a las 00:00: sirve para agrupar por mes, y las
 * métricas que necesitan la hora de verdad descartan estos mensajes por su
 * cuenta.
 */
export function aMarcaDeTiempo(
  textoFecha: string | null | undefined,
  formato: FormatoFecha
): Date | null {
  const { fecha, hora } = partirFechaHora(textoFecha);
  if (!fecha) return null;

  let anio: number;
  let mes: number;
  let dia: number;

  const iso = fecha.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    anio = Number(iso[1]);
    mes = Number(iso[2]);
    dia = Number(iso[3]);
  } else {
    const p = fecha.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (!p) return null;

    const a = Number(p[1]);
    const b = Number(p[2]);
    anio = Number(p[3]);
    /* «26» es 2026: esto son chats exportados, no documentos históricos. */
    if (anio < 100) anio += 2000;

    /* Lo que la propia fecha demuestra manda sobre lo deducido del chat: una
       fila suelta con otro formato no estropea el resto. */
    if (a > 12 && b <= 12) {
      dia = a;
      mes = b;
    } else if (b > 12 && a <= 12) {
      dia = b;
      mes = a;
    } else {
      dia = formato.diaPrimero ? a : b;
      mes = formato.diaPrimero ? b : a;
    }
  }

  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;

  const t = hora ? partirHora(hora) : { h: 0, m: 0, s: 0 };
  if (!t) return null;

  const d = new Date(anio, mes - 1, dia, t.h, t.m, t.s, 0);
  if (isNaN(d.getTime())) return null;
  /* `new Date(2026, 1, 31)` no falla: se va al 3 de marzo. Un 31 de febrero
     en el export es una fila corrupta, y vale más descartarla que colocar un
     mensaje en un mes al que no pertenece. */
  if (d.getMonth() !== mes - 1 || d.getDate() !== dia) return null;

  return d;
}
