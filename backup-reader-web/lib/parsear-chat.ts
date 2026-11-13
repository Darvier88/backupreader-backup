/**
 * Convierte el texto de un export de WhatsApp en filas [fecha, remitente, mensaje].
 *
 * FORMATOS QUE ENTIENDE
 * ---------------------
 * La línea de cada mensaje cambia según el sistema y el idioma del teléfono
 * (o del ordenador, en la exportación de WhatsApp Web / Windows):
 *
 *   Android:  13/11/26 15:27 - Ana: hola
 *             13/11/2026, 3:27 p. m. - Ana: hola
 *             11/13/26, 3:27 PM - Ana: hola
 *             13.11.26, 15:27 - Ana: hola            (alemán)
 *             2026-11-13 15:27 - Ana: hola
 *   iPhone:   [13/11/26, 15:27:05] Ana: hola
 *             [11/13/26, 3:27:05 PM] Ana: hola        (con espacio fino U+202F)
 *             [13.11.26, 15:27:05] Ana: hola
 *
 * Un mensaje empieza SOLO donde empieza una línea con fecha y hora. Lo demás
 * son líneas del mensaje anterior (los mensajes de varias líneas). Antes se
 * cortaba en cualquier fecha que apareciera, también en mitad de un texto
 * («quedamos el 13/11/26 15:00»), y el mensaje se partía en dos.
 *
 * QUÉ DEVUELVE
 * ------------
 * La fecha se normaliza a "d/m/aa" (con barras, en el orden en que venía) o a
 * "aaaa-mm-dd", que es lo que entiende lib/fechas-de-chat.ts. La hora va tal
 * cual ("15:27", "3:27 PM", "3:27 p. m."). Un mensaje sin «Nombre:» es un aviso
 * del sistema y va con remitente vacío.
 *
 * OJO: el índice de búsqueda numera los mensajes con este mismo parseo. Si se
 * cambia cómo se parte el texto en mensajes, hay que subir VERSION_INDICE
 * (lib/busqueda/indice.ts) para que los índices viejos se rehagan.
 */

/** Marcas invisibles que WhatsApp mete en el texto (LRM, RLM, ZWSP, BOM…). */
const INVISIBLES = /[​-‏‪-‮⁦-⁩﻿]/g;

/* Fecha (con / . o -), coma opcional, hora con o sin segundos y AM/PM en
   cualquiera de sus formas, corchetes opcionales (iPhone) y guion opcional
   (Android). Solo al principio de línea. */
const INICIO = new RegExp(
  "^\\[?" +
    "(\\d{1,4}[\\/.\\-]\\d{1,2}[\\/.\\-]\\d{1,4})" + // 1: fecha
    ",?\\s+" +
    "(\\d{1,2}[:.]\\d{2}(?:[:.]\\d{2})?" + // 2: hora
    "(?:\\s*(?:[AaPp]\\.?\\s?[Mm]\\.?))?)" +
    "\\]?" +
    "(?:\\s*[-–]\\s*|\\s+|$)",
  "m"
);

function normalizarFecha(fecha: string): string {
  const partes = fecha.split(/[\/.\-]/);
  if (partes.length !== 3) return fecha;
  if (partes[0].length === 4) {
    // Año primero: aaaa-mm-dd con ceros, como lo espera fechas-de-chat.
    return `${partes[0]}-${partes[1].padStart(2, "0")}-${partes[2].padStart(2, "0")}`;
  }
  return partes.join("/");
}

function normalizarHora(hora: string): string {
  return hora
    .replace(/(\d)\.(\d{2})/g, "$1:$2") // 15.27 → 15:27
    .replace(/\s+/g, " ")
    .trim();
}

function separarRemitente(resto: string): { nombre: string; texto: string } {
  const primeraLinea = resto.split("\n", 1)[0];
  const dosPuntos = primeraLinea.indexOf(": ");
  const finDeLinea = primeraLinea.endsWith(":") ? primeraLinea.length - 1 : -1;
  const corte = dosPuntos !== -1 ? dosPuntos : finDeLinea;
  if (corte > 0) {
    const nombre = primeraLinea.slice(0, corte).trim();
    // Un nombre real es corto. Si no, es un aviso del sistema con «:» dentro.
    if (nombre.length > 0 && nombre.length <= 60) {
      return { nombre, texto: resto.slice(corte + 1).trim() };
    }
  }
  return { nombre: "", texto: resto.trim() };
}

export function parsearTextoChat(texto: string): string[][] {
  if (typeof texto !== "string" || !texto) return [];

  const limpio = texto
    .replace(/\r\n?/g, "\n")
    .replace(INVISIBLES, "")
    .replace(/[  ]/g, " ");

  const filas: string[][] = [];
  let actual: { fecha: string; hora: string; lineas: string[] } | null = null;

  const cerrar = () => {
    if (!actual) return;
    const { nombre, texto: contenido } = separarRemitente(actual.lineas.join("\n"));
    filas.push([`${actual.fecha} ${actual.hora}`.trim(), nombre, contenido]);
  };

  for (const linea of limpio.split("\n")) {
    const m = linea.match(INICIO);
    if (m) {
      cerrar();
      actual = {
        fecha: normalizarFecha(m[1]),
        hora: normalizarHora(m[2]),
        lineas: [linea.slice(m[0].length)],
      };
    } else if (actual) {
      actual.lineas.push(linea);
    }
    // Lo que va antes del primer mensaje (cabeceras raras) se ignora.
  }
  cerrar();

  return filas;
}
