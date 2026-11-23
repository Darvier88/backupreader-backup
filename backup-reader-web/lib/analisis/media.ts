/**
 * Qué se compartió en el chat: fotos, vídeos, notas de voz, PDF, enlaces.
 *
 * POR QUÉ NO BASTA CON «ADJUNTOS»
 * ------------------------------
 * Un chat de 200 fotos y uno de 200 PDF no se parecen en nada, y contarlos
 * juntos como «200 archivos» borra justo la diferencia. Separados, la cifra
 * dice de qué va la conversación: quién manda las fotos, quién pasa los
 * documentos, quién habla por audio en vez de escribir.
 *
 * LO QUE EL EXPORT NO DEJA SABER, Y NO SE INVENTA
 * ----------------------------------------------
 * 1. NOTA DE VOZ O CANCIÓN. WhatsApp nombra las notas de voz «PTT-…», así que
 *    cuando el export trae los archivos se distinguen. Cuando no, un audio es
 *    un audio: va a «audios» y no se reparte a ojo.
 *
 *    En Instagram sí se sabe, y por una razón distinta: por los mensajes
 *    directos no se pueden mandar archivos de audio, solo grabar. Lo que el
 *    export guarda en `audio_files` es siempre una nota de voz, y una canción
 *    compartida viaja como enlace, no como archivo.
 * 2. UN EXPORT SIN ARCHIVOS NO DICE DE QUÉ ERAN. Deja avisos como «Archivo no
 *    incluido en la exportación», que no distingue una foto de un vídeo. Esos
 *    van a su propia fila, «adjuntos sin identificar», porque repartirlos
 *    entre fotos y vídeos sería adivinar y nadie podría comprobarlo.
 *
 * Por eso la tarjeta enseña esa fila cuando existe en vez de esconderla: un
 * total que no cuadra con la suma de las filas es peor que una fila que
 * admite lo que no se sabe.
 *
 * LOS ENLACES CUENTAN AQUÍ TAMBIÉN
 * --------------------------------
 * No son un archivo, pero son lo que más se comparte en muchos grupos, y si
 * faltaran, «lo que se compartió» se leería como una lista incompleta.
 */

import { separarEnlaces } from "./palabrasFrecuentes";
import type { Mensaje } from "./tipos";

/** Las clases que se cuentan. Son claves de i18n, en plural. */
export type ClaseMedia =
  | "fotos"
  | "vídeos"
  | "notas de voz"
  | "audios"
  | "PDF"
  | "documentos"
  | "stickers"
  | "enlaces"
  | "adjuntos sin identificar";

export type FilaMedia = {
  clase: ClaseMedia;
  total: number;
  /** Cuántos puso cada quien. */
  porAutor: Record<string, number>;
  /** Un mensaje donde aparece, para poder ir a verlo. */
  ejemplo?: number;
};

export type Media = {
  /** Todo lo compartido, incluidos los que no dicen de qué eran. */
  total: number;
  /** Solo las clases con algo, de más a menos. */
  filas: FilaMedia[];
  /** Quién compartió más cosas, sumando todas las clases. */
  porAutor: Record<string, number>;
  /**
   * Si el export vino sin archivos.
   *
   * Cambia cómo hay que leer la tarjeta entera, así que se dice: con los
   * archivos fuera, casi todo cae en «sin identificar» y las demás filas
   * salen cortas, no porque no se compartiera nada.
   */
  sinArchivos: boolean;
};

/** Una nota de voz se reconoce por el nombre que le pone WhatsApp. */
const esNotaDeVoz = (archivo?: string) => !!archivo && /(^|[/\\])ptt-/i.test(archivo.trim());

const esPdf = (archivo?: string) => !!archivo && /\.pdf$/i.test(archivo.trim());

/** Qué clase es este mensaje, o null si no comparte nada. */
function claseDe(m: Mensaje, origen?: string): ClaseMedia | null {
  switch (m.tipo) {
    case "imagen":
      return "fotos";
    case "video":
      return "vídeos";
    case "audio":
      /* En Instagram todo audio es una grabación: ver la nota de arriba. */
      if (origen === "instagram") return "notas de voz";
      return esNotaDeVoz(m.archivo) ? "notas de voz" : "audios";
    case "documento":
      return esPdf(m.archivo) ? "PDF" : "documentos";
    case "sticker":
      return "stickers";
    case "multimedia":
      return "adjuntos sin identificar";
    default:
      return null;
  }
}

export function media(mensajes: Mensaje[], origen?: string): Media {
  const cuenta = new Map<ClaseMedia, FilaMedia>();
  const porAutor: Record<string, number> = {};
  let conArchivo = 0;
  let sinArchivo = 0;

  const anotar = (clase: ClaseMedia, autor: string, indice: number, cuantos = 1) => {
    let fila = cuenta.get(clase);
    if (!fila) {
      fila = { clase, total: 0, porAutor: {}, ejemplo: indice };
      cuenta.set(clase, fila);
    }
    fila.total += cuantos;
    fila.porAutor[autor] = (fila.porAutor[autor] || 0) + cuantos;
    porAutor[autor] = (porAutor[autor] || 0) + cuantos;
  };

  for (const m of mensajes) {
    if (m.tipo === "sistema" || m.tipo === "eliminado") continue;

    const clase = claseDe(m, origen);
    if (clase) {
      anotar(clase, m.autor, m.indice);
      if (m.archivo) conArchivo++;
      else sinArchivo++;
    }

    /* Los enlaces van en el texto, así que se cuentan aparte y pueden
       convivir con un adjunto en el mismo mensaje. */
    const { enlaces } = separarEnlaces(m.contenido);
    if (enlaces > 0) anotar("enlaces", m.autor, m.indice, enlaces);
  }

  const filas = [...cuenta.values()].sort((a, b) => b.total - a.total);

  return {
    total: filas.reduce((n, f) => n + f.total, 0),
    filas,
    porAutor,
    /* «Sin archivos» cuando los adjuntos que no traen nombre son mayoría: un
       export con archivos puede tener algún aviso suelto, y uno sin ellos los
       tiene casi todos. */
    sinArchivos: sinArchivo > conArchivo,
  };
}
