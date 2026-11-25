/**
 * Tipos de `instagram-html.mjs`.
 *
 * El conversor se escribe en `.mjs` para que se pueda correr con `node` a
 * secas, sin compilar nada: quien lo usa acaba de descargar sus mensajes y no
 * tiene por qué montar un entorno. Pero las pruebas sí van en TypeScript, así
 * que aquí se declara lo que exporta.
 */

import type { HiloInstagram, MensajeInstagram } from "../../lib/parsear-instagram";

export function decodificarEntidades(texto: string): string;
export function textoVisible(html: string): string;

/** Milisegundos, u `null` si ahí no había una fecha. */
export function fechaEnMs(texto: string): number | null;
export function fechaDeBloque(bloque: string): number | null;

export function tituloDeHtml(html: string): string;
export function bloquesDeMensaje(html: string): string[];

/** Un mensaje con la forma que tendría en el export de JSON. */
export function mensajeDeBloque(
  bloque: string,
  rutaHilo?: string
): MensajeInstagram & { timestamp_ms: number | null };

/** El estropicio de codificación de Meta, para que el zip sea indistinguible. */
export function comoLoEscribeMeta(texto: string, utf8: typeof import("utf8")): string;
export function aFormatoMeta(hilo: HiloInstagram, utf8: typeof import("utf8")): HiloInstagram;

export type InformeDeHilo = {
  bloques: number;
  sinFecha: number;
  sinAutor: number;
  autores: number;
  titulo: string;
};

export function hiloDeHtml(
  paginas: string[] | string,
  opciones?: { rutaHilo?: string; carpeta?: string }
): { paginas: HiloInstagram[]; informe: InformeDeHilo };
