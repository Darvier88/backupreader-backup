/**
 * De las filas del export a mensajes que se pueden contar.
 *
 * QUÉ ENTRA Y QUÉ NO EN LOS CONTEOS
 * ---------------------------------
 * Fuera los mensajes de sistema («Juana creó el grupo», «Los mensajes están
 * cifrados…»): nadie los escribió, y meterlos haría que un grupo recién
 * creado pareciera una conversación.
 *
 * Fuera también los eliminados, pero contados aparte. «Se eliminó este
 * mensaje» no es algo que la persona escribiera, es lo que WhatsApp deja en
 * su lugar; contarlo como mensaje suyo inflaría a quien borra cosas. Se
 * enseña su número porque explica huecos que si no parecen silencios.
 *
 * LOS ADJUNTOS CUENTAN COMO MENSAJE, NO COMO PALABRAS
 * ---------------------------------------------------
 * Una foto es un mensaje: ocupa su turno y rompe un silencio. Pero el texto
 * que el export deja en su sitio («IMG-0001.jpg (archivo adjunto)») no es
 * algo que nadie haya escrito, así que no suma palabras. Si el adjunto lleva
 * pie, el pie sí cuenta: eso sí lo escribió alguien.
 *
 * PALABRAS CON `Intl.Segmenter`
 * -----------------------------
 * Partir por espacios cuenta mal en cuanto aparece un idioma que no los usa
 * igual, y cuenta «...» o «:)» como palabras. El segmentador del navegador
 * sabe qué es una palabra en cada idioma y qué es puntuación.
 */

import { nombreDelAdjunto, documentoAdjunto, esAdjuntoOmitido } from "../nombre-de-adjunto";
import { aMarcaDeTiempo, deducirFormato, type FormatoFecha } from "./fechaHora";
import type { ChatNormalizado, Mensaje, TipoMensaje } from "./tipos";

/* --- Marcas que WhatsApp deja en el texto, por idioma --- */

/** «Se eliminó este mensaje», «You deleted this message»… */
const ELIMINADOS = [
  "se eliminó este mensaje",
  "eliminaste este mensaje",
  "este mensaje fue eliminado",
  "this message was deleted",
  "you deleted this message",
  "essa mensagem foi apagada",
  "você apagou esta mensagem",
  "esta mensagem foi apagada",
  "ce message a été supprimé",
  "diese nachricht wurde gelöscht",
  "questo messaggio è stato eliminato",
];

/** «<Se editó este mensaje>» al final del texto. */
const EDITADOS = [
  "se editó este mensaje",
  "this message was edited",
  "esta mensagem foi editada",
  "ce message a été modifié",
  "diese nachricht wurde bearbeitet",
  "questo messaggio è stato modificato",
];

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const PATRON_ELIMINADO = new RegExp(
  `^\\s*[<«]?\\s*(?:${ELIMINADOS.map(escapar).join("|")})\\s*[>»]?\\s*\\.?\\s*$`,
  "i"
);

/* La marca de editado va al final, entre signos o sin ellos, y puede traer
   delante el texto real del mensaje. */
const PATRON_EDITADO = new RegExp(
  `\\s*[<«(]?\\s*(?:${EDITADOS.map(escapar).join("|")})\\s*[>»)]?\\s*$`,
  "i"
);

/** Extensión → tipo, para saber qué clase de adjunto era. */
const PORTIPO: Array<[RegExp, TipoMensaje]> = [
  [/\.(jpe?g|png|gif|webp|heic|heif|bmp|tiff?)$/i, "imagen"],
  [/\.(mp4|avi|mov|mkv|webm|3gp|wmv|flv|mpe?g)$/i, "video"],
  [/\.(mp3|wav|aac|flac|opus|m4a|ogg|amr)$/i, "audio"],
  [/\.webp$/i, "sticker"],
];

/** El aviso «imagen omitida» dice de qué era, si uno lo mira. */
const OMITIDO_PORTIPO: Array<[RegExp, TipoMensaje]> = [
  [/imagen|image|imagem|foto|bild|immagine/i, "imagen"],
  [/v[ií]deo|video/i, "video"],
  [/audio|áudio|sprachnachricht/i, "audio"],
  [/sticker|figurinha|autocolante/i, "sticker"],
  [/documento|document|dokument/i, "documento"],
];

/** El segmentador es caro de construir: uno por idioma y a reutilizarlo. */
const segmentadores = new Map<string, Intl.Segmenter>();
function segmentador(idioma: string): Intl.Segmenter | null {
  if (typeof Intl === "undefined" || typeof Intl.Segmenter !== "function") return null;
  let s = segmentadores.get(idioma);
  if (!s) {
    s = new Intl.Segmenter(idioma, { granularity: "word" });
    segmentadores.set(idioma, s);
  }
  return s;
}

/** Cuántas palabras tiene un texto. */
export function contarPalabras(texto: string, idioma = "es"): number {
  const limpio = (texto || "").trim();
  if (!limpio) return 0;

  const seg = segmentador(idioma);
  if (!seg) {
    /* Sin segmentador (navegador viejo, entorno raro) se parte por espacios.
       Cuenta un poco de más, pero el análisis sigue en pie. */
    return limpio.split(/\s+/).filter(Boolean).length;
  }

  let n = 0;
  for (const s of seg.segment(limpio)) if (s.isWordLike) n++;
  return n;
}

/** Qué clase de mensaje es, y qué texto queda una vez quitada la marca. */
function clasificar(texto: string): { tipo: TipoMensaje; resto: string } {
  const t = (texto || "").trim();

  if (!t) return { tipo: "texto", resto: "" };
  if (PATRON_ELIMINADO.test(t)) return { tipo: "eliminado", resto: "" };

  /* Documento: el ayudante ya separa el archivo del pie. */
  const doc = documentoAdjunto(t);
  if (doc) return { tipo: "documento", resto: doc.resto };

  /* Foto, audio o vídeo con archivo: el nombre sale del propio mensaje. */
  const archivo = nombreDelAdjunto(t);
  if (archivo) {
    const tipo = PORTIPO.find(([re]) => re.test(archivo))?.[1] ?? "multimedia";
    /* El pie es lo que queda al quitar la mención del archivo y su marca. */
    const resto = t
      .replace(archivo, " ")
      .replace(/\((?:[^()]{0,40})\)/g, " ")
      .replace(/<[^<>]{0,60}>/g, " ")
      .trim();
    return { tipo, resto };
  }

  /* Sin archivo, pero el export avisa de que había algo. */
  if (esAdjuntoOmitido(t)) {
    const tipo = OMITIDO_PORTIPO.find(([re]) => re.test(t))?.[1] ?? "multimedia";
    return { tipo, resto: "" };
  }

  return { tipo: "texto", resto: t };
}

export type OpcionesNormalizar = {
  /** Idioma para contar palabras. No cambia nada más. */
  idioma?: string;
  /** Respaldo del formato de fecha si el chat no lo demuestra. */
  diaPrimeroPorDefecto?: boolean;
  /** Formato ya deducido, si quien llama lo tiene. */
  formato?: FormatoFecha;
};

/**
 * Convierte las filas de `parsearTextoChat` en mensajes contables.
 *
 * Mantiene el índice de cada fila para poder enlazar un ejemplo al mensaje
 * del chat, que es lo que hace la búsqueda con `irAMensaje`.
 */
export function normalizar(
  filas: string[][],
  opciones: OpcionesNormalizar = {}
): ChatNormalizado {
  const idioma = opciones.idioma || "es";
  const formato =
    opciones.formato ?? deducirFormato(filas, opciones.diaPrimeroPorDefecto ?? true);

  const mensajes: Mensaje[] = [];
  const autores = new Set<string>();
  let eliminados = 0;
  let sistema = 0;
  let sinFecha = 0;
  let desde: Date | null = null;
  let hasta: Date | null = null;

  filas.forEach((fila, indice) => {
    const autor = (fila[1] || "").trim();
    const crudo = fila[2] || "";
    const fecha = aMarcaDeTiempo(fila[0], formato);

    if (!fecha) sinFecha++;
    else {
      if (!desde || fecha < desde) desde = fecha;
      if (!hasta || fecha > hasta) hasta = fecha;
    }

    /* Sin autor es un aviso de WhatsApp, no un mensaje de nadie. */
    if (!autor) {
      sistema++;
      mensajes.push({ indice, autor: "", fecha, tipo: "sistema", palabras: 0, texto: crudo, editado: false });
      return;
    }

    const editado = PATRON_EDITADO.test(crudo);
    const sinMarca = editado ? crudo.replace(PATRON_EDITADO, "").trim() : crudo;
    const { tipo, resto } = clasificar(sinMarca);

    if (tipo === "eliminado") eliminados++;
    else autores.add(autor);

    mensajes.push({
      indice,
      autor,
      fecha,
      tipo,
      palabras: tipo === "eliminado" ? 0 : contarPalabras(resto, idioma),
      texto: sinMarca,
      editado,
    });
  });

  return {
    mensajes,
    autores: [...autores].sort((a, b) => a.localeCompare(b)),
    eliminados,
    sistema,
    desde,
    hasta,
    sinFecha,
  };
}

/**
 * Los mensajes que entran en los conteos: ni sistema ni eliminados, y con
 * fecha entendida. Es el punto de partida de todas las métricas.
 */
export function contables(chat: ChatNormalizado): Mensaje[] {
  return chat.mensajes.filter(
    (m) => m.tipo !== "sistema" && m.tipo !== "eliminado" && m.fecha !== null
  );
}
