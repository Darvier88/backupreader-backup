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
import { esArchivoDeMensajes, pareceInstagramEnHtml } from "./origenDeExport";
import { arreglarTexto, nombreDeUri } from "../parsear-instagram";

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

/**
 * Qué carpeta del zip es una conversación.
 *
 * NO se buscan nombres de bandeja. Antes esto exigía que la carpeta colgara de
 * `messages/inbox`, `messages/archived_threads` o `messages/message_requests`,
 * y eso es apostar a que Meta no añada ni renombre ninguna: el día que lo
 * hiciera, esas conversaciones desaparecerían de la lista sin que nada
 * fallara, que es la peor forma de equivocarse.
 *
 * Lo que define una conversación no es dónde está, sino lo que tiene dentro:
 * un `message_1.json`. Así que se buscan esos archivos y su carpeta es el
 * hilo. La bandeja se lee de la ruta solo para enseñarla, y si no se reconoce,
 * no se enseña nada.
 */
const BANDEJA = /(^|\/)messages\/([^/]+)\/[^/]+\/$/i;

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

  /* Primera pasada: dónde hay mensajes. La carpeta de cada `message_N.json`
     ES una conversación, venga de donde venga. */
  const porPrefijo = new Map<string, HiloDelZip>();
  const primeros = new Map<string, typeof zip.entries[number]>();

  for (const entrada of zip.entries) {
    if (!esArchivoDeMensajes(entrada.name)) continue;
    const corte = entrada.name.lastIndexOf("/");
    if (corte < 0) continue;
    const prefijo = entrada.name.slice(0, corte + 1);
    const carpeta = prefijo.slice(0, -1).split("/").pop() || "";

    if (!porPrefijo.has(prefijo)) {
      porPrefijo.set(prefijo, {
        prefijo,
        nombre: nombreDeCarpeta(carpeta),
        participantes: [],
        archivos: 0,
        bytes: 0,
        bandeja: (prefijo.match(BANDEJA)?.[2] || "").toLowerCase(),
      });
    }
    /* El primero que aparezca sirve para sacar el título. */
    if (!primeros.has(prefijo)) primeros.set(prefijo, entrada);
  }

  /* Segunda pasada: lo que pesa cada una, contando su media. */
  const prefijos = [...porPrefijo.keys()];
  for (const entrada of zip.entries) {
    const prefijo = prefijos.find((p) => entrada.name.startsWith(p));
    if (!prefijo) continue;
    const hilo = porPrefijo.get(prefijo)!;
    hilo.archivos++;
    hilo.bytes += entrada.size || 0;
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

/** Si este zip es un export de Instagram pedido en HTML (ver `origenDeExport`). */
export async function esInstagramEnHtml(zipFile: Blob): Promise<boolean> {
  const zip = await openZip(zipFile);
  return pareceInstagramEnHtml(zip.entries.map((e) => e.name));
}

/** Si esta entrada del zip pertenece a la conversación elegida. */
export function esDelHilo(nombre: string, prefijo: string): boolean {
  if (!prefijo) return true;
  return (nombre || "").startsWith(prefijo);
}

/**
 * Cuántos archivos menciona la conversación que no están en este zip.
 *
 * POR QUÉ PASA ESTO
 * -----------------
 * Meta parte las descargas grandes en varios zips. Los mensajes pueden venir
 * en uno y las fotos en otro, y entonces el chat se abre entero pero con las
 * imágenes rotas, sin nada que explique por qué. Es de esos fallos que la
 * gente achaca a la aplicación y no vuelve.
 *
 * No se mira el nombre del archivo para adivinar si es «la parte 1»: los
 * nombres de Meta cambian. Se mira lo único que no engaña, que es si los
 * archivos que los mensajes nombran están o no están aquí dentro.
 */
export async function archivosQueFaltan(
  zipFile: Blob,
  prefijo: string
): Promise<{ faltan: number; total: number }> {
  const zip = await openZip(zipFile);

  const presentes = new Set(
    zip.entries
      .filter((e) => e.name.startsWith(prefijo))
      .map((e) => e.name.slice(e.name.lastIndexOf("/") + 1).toLowerCase())
  );

  const mencionados = new Set<string>();
  for (const entrada of zip.entries) {
    if (!entrada.name.startsWith(prefijo) || !esArchivoDeMensajes(entrada.name)) continue;
    try {
      const datos = JSON.parse(await (await entrada.getBlob()).text()) as {
        messages?: Array<Record<string, any>>;
      };
      for (const m of datos?.messages || []) {
        const uris = [
          ...(m?.photos || []),
          ...(m?.videos || []),
          ...(m?.audio_files || []),
          ...(m?.gifs || []),
          ...(m?.sticker ? [m.sticker] : []),
        ].map((x: any) => x?.uri);
        for (const uri of uris) {
          const nombre = nombreDeUri(uri).toLowerCase();
          if (nombre) mencionados.add(nombre);
        }
      }
    } catch {
      /* Un archivo de mensajes ilegible no puede decir qué falta; se salta. */
    }
  }

  let faltan = 0;
  mencionados.forEach((n) => {
    if (!presentes.has(n)) faltan++;
  });

  return { faltan, total: mencionados.size };
}
