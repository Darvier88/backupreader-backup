/**
 * Chats de ejemplo para las pruebas del análisis.
 *
 * Están escritos a mano, en el formato tal cual lo escupe cada teléfono, y se
 * pasan por el parseador de verdad: así una prueba falla si el parseador
 * cambia, que es justo lo que se quiere saber.
 */

import { parsearTextoChat } from "../../lib/parsear-chat";

/** 1:1, Android, día primero (dd/mm/aa). */
export const ANDROID_DIA_PRIMERO = `13/01/26, 9:00 - Ana: Buenos días
13/01/26, 9:02 - Beto: Buenas, ¿cómo vas?
13/01/26, 9:03 - Ana: Bien, acabando una cosa
13/01/26, 9:03 - Ana: luego te cuento
13/01/26, 14:30 - Beto: Dale
14/01/26, 10:00 - Ana: Ya está lo de ayer
14/01/26, 10:05 - Beto: Qué bien
`;

/** 1:1, Android, mes primero (mm/dd/aa): el 13 va en segundo lugar. */
export const ANDROID_MES_PRIMERO = `01/13/26, 9:00 AM - Ana: Good morning
01/13/26, 9:02 AM - Beto: Morning
01/13/26, 2:30 PM - Ana: Lunch?
01/14/26, 10:00 AM - Beto: Sure
`;

/** iOS, con corchetes y segundos. */
export const IOS = `[13/01/2026, 9:00:12] Ana: Hola
[13/01/2026, 9:01:40] Beto: Hola, ¿qué tal?
[13/01/2026, 9:02:03] Ana: Todo bien
`;

/** Multimedia, eliminados, editados y mensajes de sistema. */
export const CON_TODO = `13/01/26, 9:00 - Los mensajes están cifrados de extremo a extremo.
13/01/26, 9:01 - Ana: Mira esto
13/01/26, 9:01 - Ana: IMG-20260113-WA0001.jpg (archivo adjunto)
13/01/26, 9:02 - Beto: Qué bonito
13/01/26, 9:03 - Ana: PTT-20260113-WA0002.opus (archivo adjunto)
13/01/26, 9:04 - Beto: Se eliminó este mensaje
13/01/26, 9:05 - Ana: Te paso el contrato
13/01/26, 9:05 - Ana: Contrato firmado.pdf (archivo adjunto)
13/01/26, 9:06 - Beto: Gracias crack <Se editó este mensaje>
13/01/26, 9:07 - Ana: <Multimedia omitido>
13/01/26, 9:08 - Beto creó el grupo "Viaje"
`;

/** Ráfagas: Ana parte la misma idea en cinco mensajes. */
export const RAFAGAS = `13/01/26, 9:00 - Ana: oye
13/01/26, 9:00 - Ana: tienes un momento
13/01/26, 9:00 - Ana: es por lo de ayer
13/01/26, 9:00 - Ana: lo del presupuesto
13/01/26, 9:01 - Ana: que no me cuadra
13/01/26, 9:30 - Beto: Dime, lo miro ahora mismo y te digo algo en cuanto lo tenga claro
`;

/** Cambio de horario de verano en España: el 29/3/26 a las 2:00 pasan a 3:00. */
export const HORARIO_VERANO = `28/03/26, 23:30 - Ana: Buenas noches
29/03/26, 01:30 - Beto: Aún despierto
29/03/26, 03:30 - Ana: Ya cambió la hora
29/03/26, 04:00 - Beto: Sí, una hora menos de sueño
`;

/** Grupo de tres. */
export const GRUPO = `13/01/26, 9:00 - Ana: ¿Quedamos el viernes?
13/01/26, 9:01 - Beto: Por mí bien
13/01/26, 9:02 - Carla: Yo también puedo
13/01/26, 9:30 - Ana: Genial, a las ocho
13/01/26, 20:00 - Carla: Llego diez minutos tarde
13/01/26, 20:01 - Ana: Tranquila
14/01/26, 9:00 - Beto: Ayer estuvo muy bien
`;

/** Por debajo del mínimo de 100 mensajes. */
export const CORTO = `13/01/26, 9:00 - Ana: Hola
13/01/26, 9:01 - Beto: Hola
`;

/** Emojis compuestos: piel y familia cuentan como uno cada uno. */
export const EMOJIS = `13/01/26, 9:00 - Ana: 👍🏽
13/01/26, 9:01 - Beto: 👨‍👩‍👧 qué bonita familia
13/01/26, 9:02 - Ana: jajaja 😂😂 claro
`;

/** Fechas ambiguas: todo cae en los doce primeros días del mes. */
export const AMBIGUO = `03/04/26, 9:00 - Ana: Hola
05/04/26, 9:01 - Beto: Hola
07/04/26, 9:02 - Ana: Qué tal
`;

/** Pasa un texto de ejemplo por el parseador de verdad. */
export const filasDe = (texto: string): string[][] => parsearTextoChat(texto);

/**
 * Genera un chat grande para las pruebas de rendimiento.
 * Dos personas, mensajes repartidos por meses y horas.
 */
export function chatGrande(n: number): string[][] {
  const filas: string[][] = [];
  const autores = ["Ana", "Beto"];
  let dia = 1;
  let mes = 1;
  let anio = 24;

  for (let i = 0; i < n; i++) {
    const hora = String(8 + (i % 14)).padStart(2, "0");
    const minuto = String(i % 60).padStart(2, "0");
    filas.push([
      `${String(dia).padStart(2, "0")}/${String(mes).padStart(2, "0")}/${anio} ${hora}:${minuto}`,
      autores[i % 2],
      i % 17 === 0
        ? "IMG-20260113-WA0001.jpg (archivo adjunto)"
        : `mensaje numero ${i} con unas cuantas palabras para contar 😀`,
    ]);
    if (i % 40 === 39) {
      dia++;
      if (dia > 28) {
        dia = 1;
        mes++;
        if (mes > 12) {
          mes = 1;
          anio++;
        }
      }
    }
  }
  return filas;
}
