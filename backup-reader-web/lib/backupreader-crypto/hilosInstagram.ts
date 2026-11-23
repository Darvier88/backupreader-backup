/**
 * Las conversaciones que hay dentro de un export de Instagram.
 *
 * POR QUÉ HACE FALTA ELEGIR
 * -------------------------
 * El zip de WhatsApp es un chat. El de Instagram son TODOS: la descarga trae
 * `messages/inbox/` con una carpeta por conversación, más las archivadas y las
 * solicitudes. Subirlo entero tendría tres problemas a la vez: se sube (y se
 * paga) mucho más de lo que se quiere leer, el chat que se abre sería uno al
 * azar entre todos, y el nombre del backup no diría con quién es.
 *
 * Así que antes de cifrar nada se mira qué hay dentro y se pregunta. Un backup
 * sigue siendo una conversación, igual que con WhatsApp, y el resto de la
 * aplicación no se entera de nada.
 *
 * LO QUE SE LEE Y LO QUE NO
 * -------------------------
 * Listar el zip no descomprime nada: el índice ya trae nombres y tamaños. De
 * cada conversación se extrae SOLO su `message_1.json` para sacar el título y
 * quiénes hablan, porque una carpeta llamada `anagarcia_1182939` no le dice
 * nada a nadie. Si ese archivo no se puede leer, se usa el nombre de la
 * carpeta y se sigue: quedarse sin lista por una conversación rota sería peor.
 */

import { openZip } from "./zipStream";
import { esArchivoDeMensajes } from "./origenDeExport";
import { arreglarTexto } from "../parsear-instagram";

export type HiloDelZip = {
  /** La carpeta de la conversación dentro del zip, con la barra final. */
  prefijo: string;
  /** Lo que se le enseña a la persona. */
  nombre: string;
  /** Quiénes hablan, si el archivo lo dijo. */
  participantes: string[];
  /** Cuántos archivos tiene, contando la media. */
  archivos: number;
  /** Lo que ocupa sin comprimir, para avisar de las conversaciones grandes. */
  bytes: number;
  /** Dónde estaba: la bandeja, las archivadas o las solicitudes. */
  bandeja: string;
};

const CARPETA = /(^|\/)messages\/(inbox|archived_threads|message_requests)\/([^/]+)\//i;

/** El nombre de la carpeta, que es lo que queda cuando no hay título. */
function nombreDeCarpeta(carpeta: string): string {
  /* Instagram le pega un identificador al final: «anagarcia_1182939». No
     aporta nada y confunde, así que fuera. */
  return carpeta.replace(/_\d{5,}$/, "").trim() || carpeta;
}

/**
 * Lista las conversaciones de un export de Instagram, de la más pesada a la
 * más ligera, que es el orden en el que la gente busca la suya.
 *
 * Devuelve vacío si el zip no es de Instagram.
 */
export async function hilosDeInstagram(zipFile: Blob): Promise<HiloDelZip[]> {
  const zip = await openZip(zipFile);

  const porPrefijo = new Map<string, HiloDelZip>();
  /* Aparte del hilo para no ensuciar lo que se devuelve. */
  const primeros = new Map<string, typeof zip.entries[number]>();

  for (const entrada of zip.entries) {
    const m = entrada.name.match(CARPETA);
    if (!m) continue;

    const prefijo = entrada.name.slice(0, entrada.name.indexOf(m[3]) + m[3].length) + "/";
    let hilo = porPrefijo.get(prefijo);
    if (!hilo) {
      hilo = {
        prefijo,
        nombre: nombreDeCarpeta(m[3]),
        participantes: [],
        archivos: 0,
        bytes: 0,
        bandeja: m[2].toLowerCase(),
      };
      porPrefijo.set(prefijo, hilo);
    }

    hilo.archivos++;
    hilo.bytes += entrada.size || 0;

    /* Se guarda el `message_1.json` para leer el título después, y solo ese:
       con abrir uno por conversación basta y no hay que descomprimir el
       resto. */
    if (!primeros.has(prefijo) && esArchivoDeMensajes(entrada.name)) {
      primeros.set(prefijo, entrada);
    }
  }

  const hilos = [...porPrefijo.values()];

  for (const hilo of hilos) {
    const primero = primeros.get(hilo.prefijo);
    if (!primero) continue;
    try {
      const texto = await (await primero.getBlob()).text();
      const datos = JSON.parse(texto) as {
        title?: string;
        participants?: Array<{ name?: string }>;
      };
      /* El título y los nombres vienen con la codificación rota de Meta, y se
         arreglan con lo mismo que el resto del chat. */
      const titulo = arreglarTexto(datos?.title).trim();
      if (titulo) hilo.nombre = titulo;
      hilo.participantes = (datos?.participants || [])
        .map((p) => arreglarTexto(p?.name).trim())
        .filter(Boolean);
    } catch {
      /* Conversación ilegible: se queda con el nombre de la carpeta y la
         lista sigue entera. */
    }
  }

  return hilos.sort((a, b) => b.bytes - a.bytes);
}

/** Si esta entrada del zip pertenece a la conversación elegida. */
export function esDelHilo(nombre: string, prefijo: string): boolean {
  if (!prefijo) return true;
  return (nombre || "").startsWith(prefijo);
}
