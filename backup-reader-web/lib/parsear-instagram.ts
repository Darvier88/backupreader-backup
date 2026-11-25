/**
 * Convierte el export de mensajes de Instagram en las mismas filas
 * [fecha+hora, remitente, mensaje] que produce `parsear-chat.ts` para WhatsApp.
 *
 * POR QUÉ LAS MISMAS FILAS Y NO UN FORMATO PROPIO
 * -----------------------------------------------
 * Todo lo que viene después (pintar el chat, resolver los adjuntos contra el
 * manifiesto, el índice de búsqueda, el análisis) trabaja sobre esas filas y
 * sobre el TEXTO de cada mensaje. Si Instagram entra por el mismo sitio, no
 * hay que tocar nada de eso. Por eso un adjunto no se devuelve en un campo
 * aparte: se escribe dentro del texto como «<adjunto: nombre.jpg>», que es una
 * de las formas que `nombreDelAdjunto` ya reconoce (la de iPhone). Así una
 * foto de Instagram se resuelve, se busca y se cuenta igual que una de
 * WhatsApp, sin un camino paralelo que mantener.
 *
 * LO QUE TRAE EL EXPORT, Y LO QUE NO
 * ----------------------------------
 * 1. VIENE AL REVÉS. Dentro de cada archivo los mensajes van del más nuevo al
 *    más viejo, y una conversación larga se parte en `message_1.json`,
 *    `message_2.json`… donde el 1 es el bloque MÁS RECIENTE. Aquí se juntan
 *    todos y se ordenan por su marca de tiempo, que es lo único que no depende
 *    de cómo Meta haya decidido numerar los archivos ese día.
 * 2. EL TEXTO VIENE MAL CODIFICADO, A PROPÓSITO. Meta escribe los bytes UTF-8
 *    uno a uno como caracteres sueltos, así que «cumpleaños» llega como
 *    «cumpleaÃ±os» y los emojis como garabatos. Se arregla volviendo a leer
 *    esos bytes como UTF-8. Si el texto ya era correcto, el arreglo falla y se
 *    deja como estaba: no se puede saber de antemano, y romper un texto bueno
 *    sería peor que dejar uno malo.
 * 3. NO HAY AVISOS DE SISTEMA. El export no dice cuándo empezó la
 *    conversación ni quién entró o salió de un grupo, así que la primera fecha
 *    es la del primer mensaje guardado, y no la del primer mensaje que existió.
 * 4. LAS NOTAS DE VOZ NO SE DISTINGUEN. Un audio grabado y una canción
 *    compartida llegan igual, en `audio_files`, sin nada en el nombre que los
 *    separe. Van los dos como audio y no se adivina cuál era cuál.
 */

import utf8 from "utf8";

/** Un mensaje tal como lo escribe Meta. Solo los campos que se usan. */
export type MensajeInstagram = {
  sender_name?: string;
  timestamp_ms?: number;
  content?: string;
  photos?: Array<{ uri?: string }>;
  videos?: Array<{ uri?: string }>;
  audio_files?: Array<{ uri?: string }>;
  gifs?: Array<{ uri?: string }>;
  sticker?: { uri?: string };
  share?: { link?: string; share_text?: string };
  /** Mensaje retirado por quien lo envió. */
  is_unsent?: boolean;
};

export type HiloInstagram = {
  participants?: Array<{ name?: string }>;
  messages?: MensajeInstagram[];
  title?: string;
  thread_path?: string;
};

/**
 * Un texto solo PUEDE estar mal codificado si todos sus caracteres caben en un
 * byte.
 *
 * El estropicio de Meta consiste en escribir cada byte del UTF-8 como un
 * carácter suelto, y un byte nunca pasa de 255. Así que en cuanto aparece un
 * carácter de verdad (una ñ, un emoji), el texto ya estaba bien y no hay nada
 * que deshacer.
 *
 * Esta comprobación no sobra: `utf8.decode` NO avisa siempre de que el texto
 * ya era correcto. Con «cumpleaños 🎉» lanza, porque la ñ no encaja como
 * principio de secuencia; pero con «buenas noches 🌙», donde el emoji es lo
 * único fuera del alfabeto, no lanza: lee el emoji como si fuera un byte, lo
 * recorta y devuelve «buenas noches » con un carácter de control en vez de la
 * luna. Confiar en que lance es confiar en que el mensaje lleve un acento.
 */
const CABE_EN_BYTES = (texto: string) => !/[^\u0000-ÿ]/.test(texto);

/**
 * Deshace la codificación rota de Meta.
 *
 * `utf8.decode` lee la cadena como bytes y los interpreta como UTF-8. Si el
 * texto ya estaba bien, se devuelve tal cual: un export correcto no se puede
 * destrozar aquí.
 */
export function arreglarTexto(texto: string | undefined | null): string {
  if (!texto) return "";
  if (!CABE_EN_BYTES(texto)) return texto;
  try {
    return utf8.decode(texto);
  } catch {
    return texto;
  }
}

/** "2026-11-23 15:27", que es un formato que `fechas-de-chat.ts` entiende sin ambigüedad. */
function fechaHora(ms: number): string {
  const d = new Date(ms);
  if (isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ` +
    `${p(d.getHours())}:${p(d.getMinutes())}`
  );
}

/**
 * El nombre del archivo dentro de la carpeta del hilo.
 *
 * Las uri vienen con toda la ruta del zip delante
 * («your_instagram_activity/messages/inbox/ana_123/photos/456.jpg»), pero el
 * manifiesto indexa por el nombre suelto, igual que hace con WhatsApp.
 */
export function nombreDeUri(uri: string | undefined): string {
  if (!uri) return "";
  const limpio = uri.split("?")[0].replace(/\\/g, "/");
  return limpio.slice(limpio.lastIndexOf("/") + 1).trim();
}

/** Lo mismo que escribe WhatsApp en un iPhone, y que `nombreDelAdjunto` ya lee. */
const comoAdjunto = (nombre: string) => `<adjunto: ${nombre}>`;

/**
 * Los adjuntos de un mensaje, en el orden en que Instagram los guarda.
 *
 * Un mensaje puede traer varios (tres fotos a la vez), y también texto y foto
 * juntos. El pie va delante y los adjuntos detrás, que es como se lee.
 */
function adjuntosDe(m: MensajeInstagram): string[] {
  const uris: Array<string | undefined> = [
    ...(m.photos || []).map((x) => x?.uri),
    ...(m.videos || []).map((x) => x?.uri),
    ...(m.audio_files || []).map((x) => x?.uri),
    ...(m.gifs || []).map((x) => x?.uri),
    m.sticker?.uri,
  ];
  return uris.map(nombreDeUri).filter(Boolean).map(comoAdjunto);
}

/** El texto completo de un mensaje: lo que se escribió, lo que se compartió y lo que se adjuntó. */
export function textoDelMensaje(m: MensajeInstagram): string {
  /* Un mensaje retirado llega sin contenido y con `is_unsent`. Se escribe con
     las mismas palabras que usa WhatsApp para que el resto de la aplicación lo
     trate como lo que es, un mensaje eliminado, y no como un mensaje vacío. */
  if (m.is_unsent) return "Se eliminó este mensaje";

  const partes: string[] = [];

  const contenido = arreglarTexto(m.content);
  if (contenido) partes.push(contenido);

  /* Lo compartido (una publicación, un reel, un enlace) es lo único que queda
     de ese mensaje: sin el enlace, en el chat aparecería un hueco. */
  const enlace = (m.share?.link || "").trim();
  const pie = arreglarTexto(m.share?.share_text);
  if (pie && pie !== contenido) partes.push(pie);
  if (enlace) partes.push(enlace);

  partes.push(...adjuntosDe(m));

  return partes.join(" ").trim();
}

/**
 * Junta los archivos de un hilo y devuelve las filas, de la más vieja a la más nueva.
 *
 * Se ordena por la marca de tiempo y no por el nombre del archivo: el orden de
 * `message_1.json`, `message_2.json`… es al revés de lo que parece, y no hay
 * nada que garantice que siga siendo así. La marca de tiempo sí la escribe
 * Instagram por mensaje.
 */
export function parsearInstagram(hilos: HiloInstagram[] | HiloInstagram): string[][] {
  const lista = Array.isArray(hilos) ? hilos : [hilos];

  const mensajes: MensajeInstagram[] = [];
  for (const hilo of lista) {
    /* Cada archivo viene del más nuevo al más viejo: se le da la vuelta antes
       de ordenar para que los que compartan marca de tiempo (dos mensajes del
       mismo segundo) queden en el orden en que se escribieron. */
    mensajes.push(...[...(hilo?.messages || [])].reverse());
  }

  mensajes.sort((a, b) => (a.timestamp_ms || 0) - (b.timestamp_ms || 0));

  return mensajes.map((m) => [
    fechaHora(m.timestamp_ms || 0),
    arreglarTexto(m.sender_name),
    textoDelMensaje(m),
  ]);
}

/** Lo mismo, partiendo del texto de uno o varios `message_N.json`. */
export function parsearTextoInstagram(textos: string | string[]): string[][] {
  const lista = Array.isArray(textos) ? textos : [textos];
  const hilos: HiloInstagram[] = [];
  for (const texto of lista) {
    try {
      hilos.push(JSON.parse(texto) as HiloInstagram);
    } catch {
      /* Un archivo roto no tira la conversación entera: se queda fuera y los
         demás se leen igual. */
    }
  }
  return parsearInstagram(hilos);
}

/**
 * Quiénes hablan en el hilo, para poder enseñarlo antes de abrirlo.
 *
 * `participants` incluye a quien exportó, y en un grupo puede traer a gente
 * que ya se fue.
 */
export function participantesDe(hilo: HiloInstagram): string[] {
  return (hilo?.participants || [])
    .map((p) => arreglarTexto(p?.name))
    .filter(Boolean);
}

/** El nombre del hilo: el título que pone Instagram, o los participantes. */
export function nombreDelHilo(hilo: HiloInstagram): string {
  const titulo = arreglarTexto(hilo?.title).trim();
  if (titulo) return titulo;
  return participantesDe(hilo).join(", ");
}
