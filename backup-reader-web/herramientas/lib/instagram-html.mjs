/**
 * Lee los `message_N.html` de un export de Instagram y los devuelve con la
 * misma forma que tendrían en un export de los de JSON.
 *
 * POR QUÉ ESTO EXISTE
 * -------------------
 * Instagram deja elegir el formato de la descarga: JSON o HTML. La aplicación
 * lee el de JSON, que trae cada mensaje con su marca de tiempo y su autor en
 * un campo. El de HTML trae páginas para mirar en el navegador: el mismo
 * contenido, pero envuelto en etiquetas y con la fecha escrita en palabras
 * («Sep 14, 2017 8:09 am»), en el idioma de la cuenta.
 *
 * Volver a pedir la descarga en JSON tarda días. Esto convierte la que ya se
 * tiene, en la máquina de quien la descargó, y escribe un zip con la misma
 * estructura que tendría la descarga buena. A partir de ahí lee el parser de
 * siempre (`lib/parsear-instagram.ts`), que ya está probado. Nada nuevo entra
 * en la aplicación.
 *
 * DÓNDE ESTÁ LA PARTE FRÁGIL, Y CÓMO SE SOSTIENE
 * ----------------------------------------------
 * Las clases del HTML de Meta son nombres generados («_a6-g»), y pueden
 * cambiar de una descarga a otra. Así que aquí NADA depende de una sola clase:
 *
 *   - El bloque de un mensaje se busca por `pam` + `uiBoxWhite`, que son
 *     clases viejas de Facebook y llevan años igual; si no aparece ninguna, se
 *     cae a buscar divs que contengan un `<h2>` y una fecha, que es lo que es
 *     un mensaje mire como mire.
 *   - Dentro del bloque, el autor es el `<h2>` y la fecha es el último texto
 *     que se pueda leer como fecha. No se pide ninguna clase.
 *   - Lo adjunto se saca de `src` y `href`, no de la etiqueta: una foto puede
 *     venir en `<img>`, dentro de un `<a>`, o las dos cosas.
 *
 * Y lo que no se entienda se cuenta y se dice, en vez de desaparecer: el
 * informe del conversor avisa de cuántos bloques salieron sin fecha o sin
 * autor. Un mensaje perdido en silencio es lo peor que podría hacer esto.
 *
 * LO QUE EL HTML NO TRAE
 * ----------------------
 * - Segundos. La fecha llega al minuto, así que dos mensajes del mismo minuto
 *   comparten marca de tiempo. Se conserva el orden en que vienen, que es el
 *   que tenían.
 * - `participants`. No hay lista de participantes, así que se arma con quienes
 *   aparecen firmando mensajes.
 * - Qué audio era una nota de voz y cuál una canción. Igual que en JSON.
 */

/* ------------------------------------------------------------------ *
 * Texto
 * ------------------------------------------------------------------ */

const ENTIDADES = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  "#39": "'",
};

/** Deshace las entidades del HTML. Las numéricas también, que Meta usa. */
export function decodificarEntidades(texto) {
  return String(texto || "").replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (todo, cuerpo) => {
    const clave = cuerpo.toLowerCase();
    if (Object.prototype.hasOwnProperty.call(ENTIDADES, clave)) return ENTIDADES[clave];
    if (clave[0] === "#") {
      const n = clave[1] === "x" ? parseInt(clave.slice(2), 16) : parseInt(clave.slice(1), 10);
      if (Number.isFinite(n) && n > 0 && n <= 0x10ffff) {
        try {
          return String.fromCodePoint(n);
        } catch {
          return todo;
        }
      }
    }
    return todo;
  });
}

/**
 * El texto visible de un trozo de HTML.
 *
 * Los saltos de línea de un mensaje viajan como `<br>`, y hay que conservarlos:
 * un mensaje de varias líneas que llega en una sola se lee distinto.
 */
export function textoVisible(html) {
  return decodificarEntidades(
    String(html || "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|tr)>/gi, "\n")
      .replace(/<[^>]*>/g, "")
  )
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/* ------------------------------------------------------------------ *
 * Fechas
 * ------------------------------------------------------------------ */

/* Los meses en los idiomas en que Instagram escribe la descarga. La clave es
   el prefijo de tres letras, que distingue todos menos «mar/mai» y similares,
   que no chocan dentro de un mismo idioma. */
const MESES = {
  // inglés
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  // español
  ene: 1, abr: 4, ago: 8, dic: 12,
  // portugués / italiano / francés (los que no coinciden ya)
  fev: 2, mai: 5, out: 10, set: 9, gen: 1, mag: 5, giu: 6, lug: 7, ott: 10,
  avr: 4, juin: 6, juil: 7, aou: 8, aoû: 8, déc: 12, dez: 12,
};

function numeroDeMes(nombre) {
  const limpio = String(nombre || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z]/g, "");
  if (!limpio) return 0;
  const tres = limpio.slice(0, 3);
  if (MESES[tres]) return MESES[tres];
  /* «aou», «dec» sin tilde ya han entrado arriba; queda mirar la tabla entera
     por si el nombre es más corto que tres letras en algún idioma. */
  for (const clave of Object.keys(MESES)) {
    if (limpio.startsWith(clave)) return MESES[clave];
  }
  return 0;
}

/** La hora, si la hay: devuelve [hora, minuto] en formato de 24. */
function horaYMinuto(texto) {
  const m = String(texto || "").match(
    /(\d{1,2})[:.](\d{2})(?:[:.]\d{2})?\s*([ap])\s*\.?\s*m\s*\.?/i
  );
  if (m) {
    let h = Number(m[1]) % 12;
    if (m[3].toLowerCase() === "p") h += 12;
    return [h, Number(m[2])];
  }
  const m24 = String(texto || "").match(/(\d{1,2})[:.](\d{2})(?:[:.]\d{2})?/);
  if (m24) return [Number(m24[1]), Number(m24[2])];
  return [0, 0];
}

/**
 * La fecha de un mensaje, en milisegundos, o null si ahí no había una fecha.
 *
 * Se construye en hora LOCAL a propósito. El HTML trae la hora que Instagram
 * le enseñó a su dueño, sin decir de qué huso es; la aplicación vuelve a
 * escribirla con los métodos locales de `Date` (ver `fechaHora` en
 * `parsear-instagram.ts`). Montándola en local, lo que se ve en el chat es
 * exactamente lo que ponía en el HTML, que es lo único comprobable.
 */
export function fechaEnMs(texto) {
  const t = decodificarEntidades(String(texto || "")).replace(/ /g, " ").trim();
  if (!t) return null;

  const [hora, minuto] = horaYMinuto(t);
  const conHora = (y, mes, dia) => {
    if (!y || !mes || !dia) return null;
    if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
    const d = new Date(y, mes - 1, dia, hora, minuto, 0, 0);
    return isNaN(d.getTime()) ? null : d.getTime();
  };

  /* «Sep 14, 2017 8:09 am» · «November 24, 2026 at 8:32 PM» */
  let m = t.match(/([a-zA-ZÀ-ÿ]{3,12})\.?\s+(\d{1,2})(?:\s*,|\s+de)?\s+(\d{4})/);
  if (m && numeroDeMes(m[1])) return conHora(Number(m[3]), numeroDeMes(m[1]), Number(m[2]));

  /* «25 nov 2026, 2:18 p. m.» · «25 de noviembre de 2026 14:18» */
  m = t.match(/(\d{1,2})\s+(?:de\s+)?([a-zA-ZÀ-ÿ]{3,12})\.?\s*(?:de\s+)?(\d{4})/);
  if (m && numeroDeMes(m[2])) return conHora(Number(m[3]), numeroDeMes(m[2]), Number(m[1]));

  /* «25/11/2026» o «11/25/2026». Sin nombre de mes no hay forma de saber cuál
     de los dos números es el día, así que se mira si uno pasa de 12; si los
     dos caben, se hace caso al orden de día primero, que es el que usa
     Instagram en todos los idiomas menos en inglés de Estados Unidos. */
  m = t.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    let y = Number(m[3]);
    if (y < 100) y += y < 70 ? 2000 : 1900;
    if (a > 12 && b <= 12) return conHora(y, b, a);
    if (b > 12 && a <= 12) return conHora(y, a, b);
    return conHora(y, b, a);
  }

  return null;
}

/* ------------------------------------------------------------------ *
 * Bloques
 * ------------------------------------------------------------------ */

/** Las clases de una etiqueta, en minúsculas. */
function clasesDe(atributos) {
  const m = String(atributos || "").match(/class\s*=\s*"([^"]*)"/i);
  return (m ? m[1] : "").toLowerCase().split(/\s+/).filter(Boolean);
}

/**
 * Dónde termina la etiqueta que empieza en `desde`, contando las de dentro.
 *
 * Devuelve el índice del `<` de su cierre. Si el HTML viniera roto y el cierre
 * no apareciera, devuelve el final, que deja un bloque de más y no uno de
 * menos: un mensaje duplicado se ve; uno que falta, no.
 */
const CIERRES = { div: /<(\/?)div\b([^>]*)>/gi, main: /<(\/?)main\b([^>]*)>/gi };

function finDeEtiqueta(html, desde, etiqueta) {
  const re = CIERRES[etiqueta];
  re.lastIndex = desde;
  let hondo = 1;
  let m;
  while ((m = re.exec(html))) {
    /* Una etiqueta que se cierra sola no abre nada. */
    if (!m[1] && /\/\s*$/.test(m[2])) continue;
    hondo += m[1] ? -1 : 1;
    if (hondo === 0) return m.index;
  }
  return html.length;
}

/** Solo el `<main>`, si lo hay: fuera quedan la cabecera y el pie de página. */
function cuerpoDelChat(html) {
  const abre = String(html || "").match(/<main\b[^>]*>/i);
  if (!abre) return String(html || "");
  const desde = abre.index + abre[0].length;
  return html.slice(desde, finDeEtiqueta(html, desde, "main"));
}

/** El título de la conversación: el `<h1>` de la cabecera. */
export function tituloDeHtml(html) {
  const m = String(html || "").match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  return m ? textoVisible(m[1]) : "";
}

const ES_BLOQUE = (clases) => clases.includes("pam") && clases.includes("uiboxwhite");

/**
 * Los bloques de mensaje de una página, del más nuevo al más viejo, que es el
 * orden en que Instagram los escribe.
 *
 * Se recorre buscando divs y, al encontrar uno que sea un bloque, se salta
 * entero: dentro de un mensaje hay más divs, y ninguno es otro mensaje.
 */
export function bloquesDeMensaje(html) {
  const cuerpo = cuerpoDelChat(html);
  const bloques = [];
  const re = /<div\b([^>]*)>/gi;
  let m;
  while ((m = re.exec(cuerpo))) {
    /* Mirar las clases antes de buscar el cierre: en una conversación larga
       hay decenas de miles de divs y casi ninguno es un mensaje. */
    if (!ES_BLOQUE(clasesDe(m[1]))) continue;
    const fin = finDeEtiqueta(cuerpo, re.lastIndex, "div");
    bloques.push(cuerpo.slice(re.lastIndex, fin));
    re.lastIndex = fin;
  }
  if (bloques.length) return bloques;

  /* Respaldo, por si Meta cambia esas clases: un mensaje es un div que tiene
     un `<h2>` y, al final, algo que se lee como fecha. */
  re.lastIndex = 0;
  while ((m = re.exec(cuerpo))) {
    const fin = finDeEtiqueta(cuerpo, re.lastIndex, "div");
    const dentro = cuerpo.slice(re.lastIndex, fin);
    if (/<h2\b/i.test(dentro) && !/<h2[\s\S]*<h2/i.test(dentro) && fechaDeBloque(dentro) !== null) {
      bloques.push(dentro);
      re.lastIndex = fin;
    }
  }
  return bloques;
}

/* ------------------------------------------------------------------ *
 * Un mensaje
 * ------------------------------------------------------------------ */

const MEDIA = {
  foto: /\.(jpe?g|png|heic|webp|bmp)$/i,
  video: /\.(mp4|mov|m4v|webm|mkv)$/i,
  audio: /\.(mp3|m4a|aac|ogg|opus|wav)$/i,
  gif: /\.gif$/i,
};

/** La fecha del bloque: el último texto que se deje leer como fecha. */
export function fechaDeBloque(bloque) {
  const textos = String(bloque || "").match(/>([^<]{6,80})</g) || [];
  for (let i = textos.length - 1; i >= 0; i--) {
    const ms = fechaEnMs(textos[i].slice(1, -1));
    if (ms !== null) return ms;
  }
  return null;
}

/**
 * Los hijos directos de un bloque, en orden.
 *
 * Hace falta para separar la fecha del mensaje POR SU SITIO y no por lo que
 * ponga: en la plantilla de Meta la fecha es siempre el último hijo del
 * bloque. Si se buscara solo por texto, una fecha escrita de una forma que
 * todavía no se sepa leer acabaría pegada al final del mensaje, que es
 * exactamente el tipo de error que no se nota hasta que alguien lee su chat.
 */
function hijosDirectos(html) {
  const texto = String(html || "");
  const hijos = [];
  const re = /<([a-z][a-z0-9]*)\b([^>]*)>/gi;
  let m;
  while ((m = re.exec(texto))) {
    const etiqueta = m[1].toLowerCase();
    const desde = m.index;
    /* Las que se cierran solas, o las que no se cierran nunca, no envuelven
       nada: son un hijo de una sola etiqueta. */
    if (/\/\s*$/.test(m[2]) || ["br", "img", "source", "input", "hr", "meta"].includes(etiqueta)) {
      hijos.push({ etiqueta, html: m[0] });
      continue;
    }
    const cierre = new RegExp(`<(/?)${etiqueta}\\b[^>]*>`, "gi");
    cierre.lastIndex = re.lastIndex;
    let hondo = 1;
    let c;
    let fin = texto.length;
    while ((c = cierre.exec(texto))) {
      if (!c[1] && /\/\s*$/.test(c[0].slice(0, -1))) continue;
      hondo += c[1] ? -1 : 1;
      if (hondo === 0) {
        fin = cierre.lastIndex;
        break;
      }
    }
    hijos.push({ etiqueta, html: texto.slice(desde, fin) });
    re.lastIndex = fin;
  }
  return hijos;
}

/**
 * Un mensaje, con la forma que tendría en el export de JSON.
 *
 * `rutaHilo` es la carpeta del hilo dentro del zip. Hace falta porque en el
 * HTML las rutas de lo adjunto pueden venir relativas a la página, y en el
 * JSON van siempre desde la raíz del export.
 */
/**
 * Quita la capa de fuera si se recibió el bloque con su `<div>` envolvente.
 *
 * `bloquesDeMensaje` entrega el bloque ya abierto, pero a esta función se la
 * puede llamar con el `<div class="pam …">` entero, y entonces el autor y la
 * fecha quedarían un nivel más adentro de donde se los busca. Mejor que
 * exigirlo en un sentido: se acepta de las dos formas.
 */
function destapar(bloque) {
  let hijos = hijosDirectos(bloque);
  for (let vueltas = 0; vueltas < 4; vueltas++) {
    if (hijos.length !== 1 || hijos[0].etiqueta !== "div") break;
    const dentro = hijos[0].html.replace(/^<div\b[^>]*>/i, "").replace(/<\/div>\s*$/i, "");
    const nietos = hijosDirectos(dentro);
    /* Solo se baja si lo de dentro es un mensaje (tiene autor) o son varias
       piezas: si fuera una sola caja con texto, bajar perdería el texto. */
    if (!/<h2\b/i.test(dentro) && nietos.length < 2) break;
    hijos = nietos;
  }
  return hijos;
}

export function mensajeDeBloque(bloque, rutaHilo = "") {
  const hijos = destapar(bloque);

  /* 1. Autor: el `<h2>`. Un aviso del sistema no lleva ninguno. */
  const cabecera = hijos.find((h) => h.etiqueta === "h2");
  const h2 = cabecera && cabecera.html.match(/<h2\b[^>]*>([\s\S]*?)<\/h2>/i);
  const autor = h2 ? textoVisible(h2[1]) : "";

  /* 2. Fecha: el último hijo del bloque, que es donde la pone la plantilla de
        Meta. Se aparta aunque no se deje leer, para que no acabe dentro del
        mensaje; que no se pudo leer ya lo dice el informe. */
  const cuerpos = hijos.filter((h) => h.etiqueta !== "h2");
  const pie = cuerpos.length > 1 ? cuerpos[cuerpos.length - 1] : null;
  const contenido = (pie ? cuerpos.slice(0, -1) : cuerpos).map((h) => h.html).join("");

  const ms = pie ? fechaDeBloque(pie.html) : fechaDeBloque(bloque);

  /* 3. Lo adjunto, por la ruta y no por la etiqueta: una foto llega en `img`,
        en `a`, o en un `a` con un `img` dentro, y el enlace a una publicación
        llega en un `a` igual. Lo que los separa es a dónde apuntan. */
  const fotos = [];
  const videos = [];
  const audios = [];
  const gifs = [];
  const enlaces = [];
  const vistas = new Set();

  const rutas = contenido.match(/(?:src|href)\s*=\s*"([^"]*)"/gi) || [];
  for (const crudo of rutas) {
    const valor = decodificarEntidades((crudo.match(/"([^"]*)"/) || [, ""])[1]).trim();
    if (!valor || vistas.has(valor)) continue;
    vistas.add(valor);

    if (/^(https?:)?\/\//i.test(valor)) {
      /* Un enlace de fuera: una publicación compartida, un reel, una web. */
      enlaces.push(valor);
      continue;
    }
    if (/^(mailto:|tel:|#|data:)/i.test(valor)) continue;

    const uri = resolverRuta(valor, rutaHilo);
    if (MEDIA.gif.test(uri)) gifs.push({ uri });
    else if (MEDIA.foto.test(uri)) fotos.push({ uri });
    else if (MEDIA.video.test(uri)) videos.push({ uri });
    else if (MEDIA.audio.test(uri)) audios.push({ uri });
  }

  /* 4. El texto: lo que queda al quitar el autor, la fecha y lo adjunto. Las
        reacciones vienen en su propio bloque dentro del mensaje y NO son
        texto: sumarlas haría que un «me gusta» contara como palabras de quien
        escribió. */
  const texto = textoDelBloque(contenido, autor, ms);

  const mensaje = { sender_name: autor, timestamp_ms: ms === null ? null : ms };
  if (texto) mensaje.content = texto;
  if (fotos.length) mensaje.photos = fotos;
  if (videos.length) mensaje.videos = videos;
  if (audios.length) mensaje.audio_files = audios;
  if (gifs.length) mensaje.gifs = gifs;
  if (enlaces.length) mensaje.share = { link: enlaces[0] };
  return mensaje;
}

/**
 * La ruta de lo adjunto dentro del zip, resuelta de verdad.
 *
 * Las páginas no enlazan siempre igual. Unas descargas apuntan desde la raíz
 * del export («your_instagram_activity/messages/inbox/ana_123/photos/1.jpg») y
 * otras lo hacen relativo a la página, subiendo carpetas
 * («../../../media/photos/1.jpg»): en un export en HTML la media puede estar
 * fuera de la carpeta de la conversación. Así que hay que resolver los «..» en
 * vez de dar por hecho dónde está, o lo adjunto se busca donde no está y se
 * queda fuera sin que nadie se entere.
 */
export function resolverRuta(valor, rutaHilo = "") {
  const limpio = decodeURI(valor.split("?")[0].split("#")[0].replace(/\\/g, "/"));

  /* Desde la raíz del zip. */
  if (limpio.startsWith("/")) return limpio.replace(/^\/+/, "");

  const sube = /^\.{1,2}\//.test(limpio);
  /* Sin «./» ni «../» delante y con «messages/» dentro, ya viene entera. */
  if (!sube && limpio.includes("/messages/")) return limpio;

  const partes = (rutaHilo ? rutaHilo.replace(/\/+$/, "").split("/") : []).filter(Boolean);
  for (const trozo of limpio.split("/")) {
    if (!trozo || trozo === ".") continue;
    if (trozo === "..") partes.pop();
    else partes.push(trozo);
  }
  return partes.join("/");
}

/* Lo que Meta mete dentro del bloque y no es el mensaje. Varios idiomas,
   porque la descarga sale en el de la cuenta. */
const NO_ES_MENSAJE =
  /^(reacciones|reactions|rea[çc][õo]es|reazioni|r[ée]actions|compartido|shared|compartilhado)\b/i;

/**
 * El texto escrito, sin el autor, sin la fecha y sin lo que Meta añade.
 *
 * Se trabaja quitando trozos del HTML en vez de recogiendo los buenos: lo que
 * no se reconozca se queda DENTRO del mensaje. Al revés, un trozo nuevo que
 * Meta añadiera mañana se perdería sin que nadie se enterara.
 */
function textoDelBloque(html, autor, ms) {
  let resto = html
    .replace(/<h2\b[^>]*>[\s\S]*?<\/h2>/gi, " ")
    /* Las reacciones y otras cajas que Meta añade: se van con su contenido. */
    .replace(/<(ul|table)\b[^>]*>[\s\S]*?<\/\1>/gi, " ");

  const lineas = [];
  for (const trozo of textoVisible(resto).split("\n")) {
    const linea = trozo.trim();
    if (!linea) continue;
    if (autor && linea === autor) continue;
    if (NO_ES_MENSAJE.test(linea)) continue;
    /* La fecha, que ya está guardada aparte. */
    if (ms !== null && fechaEnMs(linea) === ms) continue;
    lineas.push(linea);
  }
  return lineas.join("\n").trim();
}

/* ------------------------------------------------------------------ *
 * La codificación de Meta
 * ------------------------------------------------------------------ */

/**
 * Deja el texto escrito como lo escribe Meta en el JSON: los bytes del UTF-8
 * uno a uno, que es lo que hace que «cumpleaños» llegue como «cumpleaÃ±os».
 *
 * POR QUÉ SE ESTROPEA A PROPÓSITO
 * -------------------------------
 * La aplicación arregla esa codificación al leer (`arreglarTexto`). Si el zip
 * convertido llevara el texto bien, pasaría por ese arreglo igualmente, y en
 * los casos en que un texto correcto se deja leer como UTF-8 válido saldría
 * roto. Escribiéndolo como lo escribiría Instagram, el zip convertido es
 * indistinguible de una descarga en JSON y recorre exactamente el mismo
 * camino, ya probado.
 *
 * Primero se arregla y luego se estropea, porque el HTML puede venir de las
 * dos formas y hay que acabar en una sola.
 *
 * Lo de mirar si cabe en bytes no sobra: el estropicio de Meta escribe cada
 * byte como un carácter, y un byte no pasa de 255, así que un texto con un
 * emoji de verdad ya estaba bien. Y `utf8.decode` no avisa de eso: con
 * «buenas noches 🌙» no lanza, lee el emoji como si fuera un byte y devuelve
 * «buenas noches » con un carácter de control donde estaba la luna.
 */
export function comoLoEscribeMeta(texto, utf8) {
  if (!texto) return texto;
  let bueno = texto;
  if (!/[^\u0000-ÿ]/.test(texto)) {
    try {
      bueno = utf8.decode(texto);
    } catch {
      /* Ya estaba bien. */
    }
  }
  try {
    return utf8.encode(bueno);
  } catch {
    /* Un emoji a medias (un surrogate suelto) no se puede codificar. Se deja
       como está: romperlo sería peor que dejarlo. */
    return bueno;
  }
}

/** Lo mismo, sobre todos los textos de una conversación. */
export function aFormatoMeta(hilo, utf8) {
  const t = (s) => comoLoEscribeMeta(s, utf8);
  return {
    ...hilo,
    title: t(hilo.title),
    participants: (hilo.participants || []).map((p) => ({ ...p, name: t(p.name) })),
    messages: (hilo.messages || []).map((m) => {
      const copia = { ...m, sender_name: t(m.sender_name) };
      if (copia.content) copia.content = t(copia.content);
      if (copia.share?.share_text) {
        copia.share = { ...copia.share, share_text: t(copia.share.share_text) };
      }
      return copia;
    }),
  };
}

/* ------------------------------------------------------------------ *
 * Una conversación
 * ------------------------------------------------------------------ */

/**
 * Convierte las páginas de una conversación en el objeto que tendría su
 * `message_N.json`.
 *
 * `paginas` va en el mismo orden que los archivos: la 1 es la más reciente.
 * Aquí no se ordena nada ni se le da la vuelta a nada, porque el parser de la
 * aplicación ya hace las dos cosas y hacerlas dos veces sería deshacerlas.
 *
 * Un mensaje sin fecha hereda la del anterior de su misma página. Dejarlo en
 * cero lo mandaría al principio de la conversación, años antes de donde
 * estaba; heredarla lo deja donde se escribió, con el minuto de al lado.
 */
export function hiloDeHtml(paginas, { rutaHilo = "", carpeta = "" } = {}) {
  const lista = Array.isArray(paginas) ? paginas : [paginas];

  const porPagina = [];
  const autores = new Set();
  /* Las rutas de lo adjunto, para que quien copie los archivos sepa cuáles
     buscar. En un export en HTML la media puede no estar en la carpeta de la
     conversación, así que no vale con copiar esa carpeta entera. */
  const adjuntos = new Set();
  let titulo = "";
  let sinFecha = 0;
  let sinAutor = 0;
  let bloques = 0;

  for (const pagina of lista) {
    const html = String(pagina || "");
    if (!titulo) titulo = tituloDeHtml(html);

    const mensajes = [];
    let ultima = null;
    for (const bloque of bloquesDeMensaje(html)) {
      bloques++;
      const m = mensajeDeBloque(bloque, rutaHilo);
      if (m.timestamp_ms === null) {
        sinFecha++;
        m.timestamp_ms = ultima === null ? 0 : ultima;
      } else {
        ultima = m.timestamp_ms;
      }
      if (!m.sender_name) sinAutor++;
      else autores.add(m.sender_name);
      for (const grupo of [m.photos, m.videos, m.audio_files, m.gifs]) {
        for (const x of grupo || []) if (x?.uri) adjuntos.add(x.uri);
      }
      mensajes.push(m);
    }
    porPagina.push(mensajes);
  }

  /* Si los primeros mensajes de una página salieron sin fecha, no había
     ninguna anterior de la que tirar; se les pone la primera que apareció. */
  for (const mensajes of porPagina) {
    const primera = mensajes.find((m) => m.timestamp_ms)?.timestamp_ms;
    if (!primera) continue;
    for (const m of mensajes) if (!m.timestamp_ms) m.timestamp_ms = primera;
  }

  const participantes = [...autores].map((name) => ({ name }));

  return {
    paginas: porPagina.map((mensajes) => ({
      participants: participantes,
      messages: mensajes,
      title: titulo || carpeta,
      thread_path: rutaHilo,
    })),
    informe: {
      bloques,
      sinFecha,
      sinAutor,
      autores: autores.size,
      titulo,
      adjuntos: [...adjuntos],
    },
  };
}
