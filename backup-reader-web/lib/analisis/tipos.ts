/**
 * Los tipos que comparten todas las piezas del análisis.
 *
 * Están aparte para que cada función pueda importar solo lo que usa sin
 * arrastrar al resto, y para que la forma del resultado quede escrita en un
 * único sitio: es lo que se guarda cifrado en la caché y lo que lee la
 * interfaz, así que cambiarlo tiene consecuencias en los dos extremos.
 */

/** Qué clase de mensaje es. Lo decide `normalizar`. */
export type TipoMensaje =
  | "texto"
  | "imagen"
  | "video"
  | "audio"
  | "documento"
  | "sticker"
  | "multimedia" /* se sabe que había un adjunto, no de qué clase */
  | "eliminado"
  | "sistema";

/** Un mensaje ya interpretado, listo para contar. */
export type Mensaje = {
  /** Posición en el array de filas original, para poder enlazar al chat. */
  indice: number;
  /** Quien lo escribió. Vacío en los mensajes de sistema. */
  autor: string;
  /** Marca de tiempo tal como venía en el export, sin convertir husos. */
  fecha: Date | null;
  tipo: TipoMensaje;
  /** Palabras del texto, sin contar la marca del adjunto ni la de editado. */
  palabras: number;
  /** El texto, ya sin la marca «<se editó este mensaje>». */
  texto: string;
  /**
   * Solo lo que escribió la persona: el pie de una foto, sin el nombre del
   * archivo ni el aviso del export. Vacío en un adjunto sin pie.
   *
   * Va aparte de `texto` porque las dos cosas hacen falta: `texto` es lo que
   * se enseña y lo que se busca; `contenido` es lo que se cuenta. Contar
   * sobre `texto` metería «IMG-20260113-WA0001.jpg» entre las palabras más
   * usadas del chat de quien manda muchas fotos.
   */
  contenido: string;
  /** El mensaje llevaba la marca de editado. */
  editado: boolean;
  /**
   * El nombre del archivo adjunto, cuando el export lo trae.
   *
   * Hace falta para lo que `tipo` no distingue: un PDF de otro documento, y
   * una nota de voz («PTT-…») de una canción compartida. Un export sin
   * archivos no lo trae, y entonces esas dos cosas no se pueden separar sin
   * inventarlas.
   */
  archivo?: string;
};

/**
 * Un turno: mensajes seguidos del mismo autor.
 *
 * Existe para no premiar a quien parte una idea en seis mensajes. Todo lo que
 * mide ritmo —quién inicia, cuánto tarda en responder— cuenta turnos; lo que
 * mide volumen —cuánto escribe— sigue contando mensajes y palabras.
 */
export type Turno = {
  autor: string;
  /** Mensajes del turno, en orden. */
  mensajes: Mensaje[];
  /** Fecha del primer mensaje del turno. */
  inicio: Date;
  /** Fecha del último mensaje del turno. */
  fin: Date;
  /** Suma de palabras de los mensajes del turno. */
  palabras: number;
};

/** Lo que `normalizar` devuelve del chat entero. */
export type ChatNormalizado = {
  mensajes: Mensaje[];
  /** Autores que han escrito al menos un mensaje contable, en orden alfabético. */
  autores: string[];
  /** Mensajes que el export marca como eliminados: van aparte de los conteos. */
  eliminados: number;
  /** Mensajes de sistema: fuera de todos los conteos. */
  sistema: number;
  /** Primera y última fecha entendida, para el rango que se enseña arriba. */
  desde: Date | null;
  hasta: Date | null;
  /** Cuántas filas traían una fecha que no se pudo interpretar. */
  sinFecha: number;
};
