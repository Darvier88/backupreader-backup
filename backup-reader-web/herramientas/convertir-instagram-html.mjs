/**
 * Convierte un export de Instagram descargado en HTML al formato JSON, en tu
 * propia máquina.
 *
 * PARA QUÉ
 * --------
 * Instagram deja elegir el formato de la descarga. BackupReader lee la de
 * JSON, que trae cada mensaje con su autor y su marca de tiempo en un campo.
 * Si la descarga salió en HTML, la aplicación lo dice y no la abre: adivinar
 * dónde está cada cosa dentro de una página web no es algo que deba pasar con
 * las conversaciones de nadie.
 *
 * Volver a pedir la descarga en JSON tarda días. Esto convierte la que ya
 * tienes, y escribe un zip con la misma estructura que habría tenido la buena.
 *
 * DÓNDE PASA TODO ESTO
 * --------------------
 * En tu ordenador y en ningún otro sitio. Este programa no se conecta a nada:
 * lee el zip que le des y escribe otro al lado. Tus conversaciones no salen de
 * ahí.
 *
 * CÓMO SE USA
 * -----------
 *   # 1. Ver qué conversaciones hay dentro
 *   node herramientas/convertir-instagram-html.mjs "C:\\ruta\\instagram.zip"
 *
 *   # 2. Convertir la que quieras (el número que salió en la lista)
 *   node herramientas/convertir-instagram-html.mjs "C:\\ruta\\instagram.zip" --hilo 3
 *
 *   # varias a la vez, o todas
 *   ... --hilo 3,7,12
 *   ... --todas
 *
 * Deja un zip por conversación al lado del original. Ese zip es el que se
 * sube a BackupReader.
 *
 * POR QUÉ UN ZIP POR CONVERSACIÓN Y NO UNO CON TODO
 * -------------------------------------------------
 * Un backup es una conversación, así que lo que se sube es una. Separarlas
 * aquí hace que cada zip pese lo que pesa esa conversación y no la descarga
 * entera, que son gigas: se sube antes, se cifra antes y no hay que elegir
 * dos veces.
 */

import { createWriteStream, existsSync, openAsBlob, readFileSync, statSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { Writable } from "node:stream";
import utf8 from "utf8";
import {
  BlobReader,
  BlobWriter,
  TextReader,
  TextWriter,
  ZipReader,
  ZipWriter,
  configure,
} from "@zip.js/zip.js";

import { aFormatoMeta, hiloDeHtml } from "./lib/instagram-html.mjs";

/** El avance, solo si hay una terminal delante: con la salida redirigida a un
    archivo, el «\r» no borra nada y queda un churro de miles de líneas. */
const avance = (texto) => {
  if (process.stdout.isTTY) process.stdout.write(texto + "\r");
};

/* En Node no hay por qué levantar hilos de trabajo: el cuello de botella es el
   disco, y así el programa no deja procesos sueltos al terminar. */
configure({ useWebWorkers: false });

/* ------------------------------------------------------------------ *
 * Lo que se pidió
 * ------------------------------------------------------------------ */

const args = process.argv.slice(2);
const ruta = args.find((a) => !a.startsWith("--"));
const pide = (nombre) => {
  const i = args.indexOf("--" + nombre);
  return i >= 0 ? args[i + 1] : undefined;
};
const todas = args.includes("--todas") || args.includes("--todos");
const pedidos = (pide("hilo") || "")
  .split(/[,\s]+/)
  .map((n) => Number(n))
  .filter((n) => Number.isInteger(n) && n > 0);

if (!ruta || !existsSync(ruta)) {
  console.error(
    [
      "Falta el zip del export, o esa ruta no existe.",
      "",
      "  node herramientas/convertir-instagram-html.mjs \"C:\\\\ruta\\\\instagram.zip\"",
      "",
      "Eso enseña las conversaciones. Luego, para convertir una:",
      "",
      "  node herramientas/convertir-instagram-html.mjs \"C:\\\\ruta\\\\instagram.zip\" --hilo 3",
    ].join("\n")
  );
  process.exit(1);
}

/* ------------------------------------------------------------------ *
 * El zip de entrada
 * ------------------------------------------------------------------ */

const ES_PAGINA = /(^|\/)message_(\d+)\.html$/i;

/* `openAsBlob` apunta al archivo sin leerlo entero. Un export de Instagram
   pesa gigas y cargarlo en memoria revienta antes de empezar. */
const fuente =
  typeof openAsBlob === "function" ? await openAsBlob(ruta) : new Blob([readFileSync(ruta)]);

const zip = new ZipReader(new BlobReader(fuente));
const entradas = await zip.getEntries();

console.log("Export:", basename(ruta), "·", (statSync(ruta).size / 1e9).toFixed(2), "GB");

/* Las conversaciones son las carpetas que tienen páginas de mensajes dentro.
   No se buscan nombres de bandeja: el día que Meta añada o renombre una, las
   conversaciones de ahí desaparecerían sin que nada fallara. */
const hilos = new Map();
for (const entrada of entradas) {
  if (!ES_PAGINA.test(entrada.filename)) continue;
  const carpeta = entrada.filename.slice(0, entrada.filename.lastIndexOf("/"));
  if (!hilos.has(carpeta)) {
    hilos.set(carpeta, { carpeta, paginas: [], otros: [], bytes: 0 });
  }
  hilos.get(carpeta).paginas.push(entrada);
}

if (hilos.size === 0) {
  console.error(
    [
      "",
      "En ese zip no hay ninguna página de mensajes (message_1.html).",
      "",
      "Si la descarga salió en JSON, no hace falta convertir nada: ese zip se",
      "sube tal cual. Y si es un export de otra cosa (fotos, perfil), los",
      "mensajes no están ahí; hay que pedirlos aparte.",
    ].join("\n")
  );
  await zip.close();
  process.exit(1);
}

/* Lo que acompaña a cada conversación dentro de su propia carpeta. OJO: en un
   export en HTML la media puede estar FUERA de ahí, en una carpeta aparte del
   export, y entonces esto no la ve. Por eso lo adjunto de verdad se busca
   después, por las rutas que enlazan las páginas. */
const carpetas = [...hilos.keys()];
for (const entrada of entradas) {
  if (entrada.directory) continue;
  const carpeta = carpetas.find((c) => entrada.filename.startsWith(c + "/"));
  if (!carpeta) continue;
  const hilo = hilos.get(carpeta);
  hilo.bytes += entrada.uncompressedSize || 0;
  if (!ES_PAGINA.test(entrada.filename)) hilo.otros.push(entrada);
}

/* El índice del zip, para encontrar un archivo esté donde esté. El de por
   nombre suelto es el respaldo: si una página enlaza con una ruta que no
   cuadra con cómo está guardado el archivo, el nombre sigue siendo el mismo. */
const porRuta = new Map();
const porNombre = new Map();
for (const entrada of entradas) {
  if (entrada.directory) continue;
  porRuta.set(entrada.filename, entrada);
  const suelto = entrada.filename.split("/").pop();
  if (!porNombre.has(suelto)) porNombre.set(suelto, entrada);
}
const buscarArchivo = (uri) => porRuta.get(uri) || porNombre.get(uri.split("/").pop()) || null;

/* Las páginas, de la 1 en adelante: la 1 es el bloque más reciente, igual que
   en el export de JSON. */
for (const hilo of hilos.values()) {
  hilo.paginas.sort(
    (a, b) => Number(a.filename.match(ES_PAGINA)[2]) - Number(b.filename.match(ES_PAGINA)[2])
  );
}

/* El orden de la lista, y por tanto lo que significa `--hilo 3`.
 *
 * Se ordena por lo que ocupan las PÁGINAS, que es lo más parecido a «cuántos
 * mensajes tiene» que se puede saber sin leerlas, y se desempata por el nombre
 * de la carpeta. Tiene que salir igual al listar y al convertir, y por eso no
 * se ordena por el número de mensajes: eso obligaría a leer las 368 páginas
 * también al convertir una sola, y un número que significara una cosa en una
 * orden y otra en la siguiente sería una trampa.
 */
for (const hilo of hilos.values()) {
  hilo.bytesPaginas = hilo.paginas.reduce((n, e) => n + (e.uncompressedSize || 0), 0);
}
const lista = [...hilos.values()].sort(
  (a, b) => b.bytesPaginas - a.bytesPaginas || a.carpeta.localeCompare(b.carpeta)
);

const comoNombre = (carpeta) =>
  (carpeta.split("/").pop() || carpeta).replace(/_\d{5,}$/, "") || carpeta;

const enMb = (b) => (b / 1e6).toFixed(b < 10e6 ? 1 : 0) + " MB";

/** Lee las páginas de una conversación y las convierte. */
async function leerHilo(hilo) {
  const paginasHtml = [];
  for (const entrada of hilo.paginas) {
    paginasHtml.push(await entrada.getData(new TextWriter()));
  }
  return hiloDeHtml(paginasHtml, {
    rutaHilo: hilo.carpeta,
    carpeta: comoNombre(hilo.carpeta),
  });
}

/**
 * Lo adjunto que enlazan las páginas, con dónde está y dónde va a ir.
 *
 * Va DENTRO de la carpeta de la conversación aunque en el export estuviera
 * fuera, y no por gusto: al subir, la aplicación sube solo lo que cuelga del
 * prefijo de la conversación elegida (`soloPrefijo` en StorageContext), así
 * que una foto guardada en otra carpeta del zip no se subiría y en el chat
 * saldría un adjunto que no se puede abrir.
 */
function dondeVaCadaAdjunto(informe, rutaHilo) {
  const destinos = new Map();
  const usados = new Set();
  const sinEncontrar = [];
  let bytes = 0;

  for (const uri of informe.adjuntos || []) {
    const entrada = buscarArchivo(uri);
    if (!entrada) {
      sinEncontrar.push(uri);
      continue;
    }
    const trozos = uri.split("/");
    const suelto = trozos.pop();
    /* Se conserva la subcarpeta («photos», «videos», «audio») porque es lo que
       hace que el zip se entienda al abrirlo. */
    const sub = trozos.length && trozos[trozos.length - 1] !== rutaHilo.split("/").pop()
      ? trozos[trozos.length - 1] + "/"
      : "";
    let destino = `${rutaHilo}/${sub}${suelto}`;
    /* Dos archivos distintos con el mismo nombre existirían el uno encima del
       otro: se le pone un número al segundo. */
    for (let n = 2; usados.has(destino); n++) {
      destino = `${rutaHilo}/${sub}${suelto.replace(/(\.[^.]+)?$/, `-${n}$1`)}`;
    }
    usados.add(destino);
    destinos.set(uri, { entrada, destino });
    bytes += entrada.uncompressedSize || 0;
  }

  return { destinos, sinEncontrar, bytes };
}

/** Deja en los mensajes la ruta donde el adjunto va a quedar de verdad. */
function reescribirAdjuntos(paginas, destinos) {
  for (const p of paginas) {
    for (const m of p.messages || []) {
      for (const clave of ["photos", "videos", "audio_files", "gifs"]) {
        if (!m[clave]) continue;
        m[clave] = m[clave].map((x) => ({
          ...x,
          uri: destinos.get(x.uri)?.destino || x.uri,
        }));
      }
    }
  }
}

/* ------------------------------------------------------------------ *
 * Sin --hilo: solo se enseña lo que hay
 * ------------------------------------------------------------------ */

if (!todas && pedidos.length === 0) {
  console.log("\nMirando las", lista.length, "conversaciones…");

  const filas = [];
  for (let i = 0; i < lista.length; i++) {
    const h = lista[i];
    avance("  " + (i + 1) + "/" + lista.length);
    const { informe } = await leerHilo(h);
    const { destinos, sinEncontrar, bytes } = dondeVaCadaAdjunto(informe, h.carpeta);
    filas.push({
      hilo: h,
      mensajes: informe.bloques,
      adjuntos: destinos.size,
      sinEncontrar: sinEncontrar.length,
      /* Lo que va a pesar el zip convertido: las páginas no van dentro. */
      bytes: bytes + informe.bloques * 200,
    });
  }

  console.log("\nCONVERSACIONES EN ESTE EXPORT:", filas.length, "\n");
  filas.forEach((f, i) => {
    const bandeja = (f.hilo.carpeta.match(/(^|\/)messages\/([^/]+)\//i) || [])[2] || "";
    const cola = [
      f.adjuntos ? f.adjuntos + (f.adjuntos === 1 ? " adjunto" : " adjuntos") : "",
      f.sinEncontrar ? f.sinEncontrar + " sin archivo en el zip" : "",
      bandeja && bandeja !== "inbox" ? bandeja : "",
    ].filter(Boolean);
    console.log(
      ("  " + String(i + 1).padStart(3) + ". " +
        comoNombre(f.hilo.carpeta).padEnd(32).slice(0, 32) + " " +
        String(f.mensajes).padStart(6) + (f.mensajes === 1 ? " mensaje " : " mensajes") +
        " · " + enMb(f.bytes).padStart(9) +
        (cola.length ? " · " + cola.join(" · ") : "")).trimEnd()
    );
  });

  const conMensajes = filas.filter((f) => f.mensajes > 0).length;
  if (conMensajes < filas.length) {
    console.log(
      "\n  (" + (filas.length - conMensajes) + " salieron sin ningún mensaje reconocible)"
    );
  }

  console.log(
    [
      "",
      "Para convertir una, su número:",
      "",
      '  node herramientas/convertir-instagram-html.mjs "' + ruta + '" --hilo 1',
      "",
      "Nada ha salido de tu máquina: esto solo ha leído el zip.",
    ].join("\n")
  );
  await zip.close();
  process.exit(0);
}

/* ------------------------------------------------------------------ *
 * Convertir
 * ------------------------------------------------------------------ */

const aConvertir = todas
  ? lista
  : pedidos
      .map((n) => lista[n - 1])
      .filter((h, i) => {
        if (!h) console.error("No hay ninguna conversación con el número", pedidos[i]);
        return !!h;
      });

if (aConvertir.length === 0) {
  await zip.close();
  process.exit(1);
}

const resumen = [];

for (const hilo of aConvertir) {
  const nombre = comoNombre(hilo.carpeta);
  console.log("\n—", nombre, "·", hilo.paginas.length, "página(s) ·", enMb(hilo.bytes));

  /* 1. Leer las páginas y convertirlas. */
  const { paginas, informe } = await leerHilo(hilo);

  const mensajes = paginas.reduce((n, p) => n + p.messages.length, 0);
  console.log("  mensajes:", mensajes, " ".repeat(20));
  if (informe.sinFecha) {
    console.log(
      "  sin fecha legible:",
      informe.sinFecha,
      "(se quedan junto al mensaje anterior, no al principio)"
    );
  }
  if (informe.sinAutor) {
    console.log("  sin autor:", informe.sinAutor, "(avisos del sistema, normalmente)");
  }
  if (mensajes === 0) {
    console.log("  *** no se reconoció ningún mensaje: esta conversación se salta ***");
    resumen.push({ nombre, mensajes: 0, salida: null });
    continue;
  }

  /* 2. Localizar lo adjunto. En un export en HTML puede estar fuera de la
        carpeta de la conversación, así que se busca por las rutas que enlazan
        las páginas y se copia dentro. */
  const { destinos, sinEncontrar } = dondeVaCadaAdjunto(informe, hilo.carpeta);
  reescribirAdjuntos(paginas, destinos);
  if (sinEncontrar.length) {
    console.log(
      "  adjuntos que no están en el zip:",
      sinEncontrar.length,
      "(se nombran en el chat, pero el archivo no viene en la descarga)"
    );
  }

  /* 3. Escribir el zip. Se escribe directo al disco, sin montarlo entero en
        memoria: una conversación con vídeos puede pesar cientos de megas. */
  const salida = join(dirname(ruta), "convertido-" + aSalvo(nombre) + ".zip");
  const destino = new ZipWriter(Writable.toWeb(createWriteStream(salida)), {
    bufferedWrite: false,
  });

  for (let i = 0; i < paginas.length; i++) {
    const json = JSON.stringify(aFormatoMeta(paginas[i], utf8));
    await destino.add(`${hilo.carpeta}/message_${i + 1}.json`, new TextReader(json));
  }

  /* Lo adjunto va tal cual. Sin comprimir: una foto o un vídeo ya vienen
     comprimidos y volver a intentarlo solo gasta tiempo.
     Las páginas .html NO se copian, a propósito: si quedara una, la aplicación
     vería el export como de los de HTML y volvería a rechazarlo. */
  let copiados = 0;
  const yaPuestos = new Set();
  for (const { entrada, destino: dentroDelZip } of destinos.values()) {
    if (yaPuestos.has(dentroDelZip)) continue;
    yaPuestos.add(dentroDelZip);
    avance("  copiando adjuntos " + ++copiados + "/" + destinos.size);
    const datos = await entrada.getData(new BlobWriter());
    await destino.add(dentroDelZip, new BlobReader(datos), { level: 0 });
  }

  /* Y lo que estuviera en la carpeta de la conversación sin que ninguna página
     lo enlazara: si no se reconoció el enlace, mejor que el archivo viaje a que
     se quede fuera. */
  for (const entrada of hilo.otros) {
    if (yaPuestos.has(entrada.filename)) continue;
    yaPuestos.add(entrada.filename);
    avance("  copiando adjuntos " + ++copiados);
    const datos = await entrada.getData(new BlobWriter());
    await destino.add(entrada.filename, new BlobReader(datos), { level: 0 });
  }
  if (copiados) console.log("  adjuntos copiados:", copiados, " ".repeat(20));

  await destino.close();
  console.log("  listo →", salida, "·", enMb(statSync(salida).size));
  resumen.push({ nombre, mensajes, salida });
}

await zip.close();

/* ------------------------------------------------------------------ *
 * Qué hacer con esto
 * ------------------------------------------------------------------ */

const hechos = resumen.filter((r) => r.salida);
console.log("\n" + "-".repeat(60));
if (hechos.length === 0) {
  console.log("No salió ninguna conversación convertida.");
  process.exit(1);
}
console.log("Convertidas:", hechos.length);
for (const r of hechos) console.log("  ", r.mensajes, "mensajes ·", basename(r.salida));
console.log(
  [
    "",
    "Esos zip son los que se suben a BackupReader, uno por conversación.",
    "El original no se ha tocado.",
  ].join("\n")
);

/** Un nombre de archivo que no se pelee con el sistema. */
function aSalvo(nombre) {
  return (
    String(nombre)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "conversacion"
  );
}
