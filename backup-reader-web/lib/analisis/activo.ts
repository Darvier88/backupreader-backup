/**
 * ¿Está encendido el análisis de chats?
 *
 * POR QUÉ NO VA EN `funciones-activas.ts`
 * ---------------------------------------
 * Ese archivo guarda interruptores que se cambian tocando el código y
 * desplegando. Este se apaga y se enciende por entorno: queremos poder
 * tenerlo encendido en una vista previa y apagado en producción sin dos
 * ramas distintas, y poder apagarlo en caliente si un chat raro hace que el
 * cálculo se atasque, sin esperar a un despliegue.
 *
 * APAGADO SI FALTA, A PROPÓSITO
 * -----------------------------
 * Una variable que no está es lo que pasa en el entorno de alguien que acaba
 * de clonar el repositorio, en las pruebas y en cualquier despliegue viejo.
 * En todos esos sitios lo correcto es que la pestaña no aparezca, no que
 * aparezca a medias.
 *
 * El nombre completo está escrito a mano en la comparación porque Next
 * sustituye `process.env.NEXT_PUBLIC_*` por su valor al compilar, y solo lo
 * hace cuando ve el nombre entero en el código. Leerlo con una variable
 * (`process.env[nombre]`) deja `undefined` en el navegador.
 */

/** `true` solo si la variable existe y vale exactamente "1" o "true". */
export const ANALISIS_ACTIVO: boolean = (() => {
  const valor = process.env.NEXT_PUBLIC_ANALISIS_ENABLED;
  return valor === "1" || valor === "true";
})();
