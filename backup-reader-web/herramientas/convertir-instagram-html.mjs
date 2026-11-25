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
 *   # Convertir el export entero, con todas sus conversaciones
 *   node herramientas/convertir-instagram-html.mjs "C:\\ruta\\instagram.zip"
 *
 *   # Ver qué conversaciones hay dentro, sin convertir nada
 *   node herramientas/convertir-instagram-html.mjs "C:\\ruta\\instagram.zip" --lista
 *
 *   # Convertir solo algunas (los números que salen en --lista)
 *   node herramientas/convertir-instagram-html.mjs "C:\\ruta\\instagram.zip" --hilo 1,3,7
 *
 * Deja UN zip al lado del original, con todas las conversaciones dentro. Ese
 * zip es el que se sube a BackupReader: al subirlo, la aplicación enseña la
 * lista y se elige cuál abrir, igual que con una descarga en JSON de verdad.
 *
 * POR QUÉ UNO SOLO Y NO UNO POR CONVERSACIÓN
 * ------------------------------------------
 * Porque es lo que hace que el zip convertido sea indistinguible de la
 * descarga buena. La aplicación ya sabe abrir un export con todas las
 * conversaciones dentro: las lista, deja elegir y sube SOLO la elegida. Sacar
 * 368 archivos obligaría a elegir antes, aquí, a ciegas y en una terminal.
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
  if (process.stdout.isTTY) process.stdout.write(texto + "          \r");
};

/* En Node no hay por qué levantar hilos de trabajo: el cuello de botella es el
   disco, y así el programa no deja procesos sueltos al terminar. */
configure({ useWebWorkers: false });

/* ------------------------------------------------------------------ *
 * Lo que se pidió
 * ------------------------------------------------------------------ */

const args = process.argv.slice(2);
const ruta = args.find((a) => !a.startsWith("--") && !/^[\d,\s]+$/.test(a));
const pide = (nombre) => {
  const i = args.indexOf("--" + nombre);
  return i >= 0 ? args[i + 1] : undefined;
};
const soloLista = args.includes("--lista");
const pedidos = (pide("hilo") || "")
  .split(/[,\s]+/)
  .map((n) => Number(n))
  .filter((n) => Number.isInteger(n) && n > 0);

if (!ruta || !existsSync(ruta)) {
  console.error(
    [
      "Falta el zip del export, o esa ruta no existe.",
      "",
      '  node herramientas/convertir-instagram-html.mjs "C:\\\\ruta\\\\instagram.zip"',
      "",
      "Eso convierte el export entero. Para ver antes qué hay dentro, añade --lista.",
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
 * se ordena por el número de mensajes: un número que significara una cosa en
 * una orden y otra en la siguiente sería una trampa.
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
    const sub =
      trozos.length && trozos[trozos.length - 1] !== rutaHilo.split("/").pop()
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
 * Qué conversaciones entran
 * ------------------------------------------------------------------ */

const aConvertir = pedidos.length
  ? pedidos
      .map((n) => lista[n - 1])
      .filter((h, i) => {
        if (!h) console.error("No hay ninguna conversación con el número", pedidos[i]);
        return !!h;
      })
  : lista;

if (aConvertir.length === 0) {
  await zip.close();
  process.exit(1);
}

console.log(
  soloLista
    ? `\nMirando las ${aConvertir.length} conversaciones…`
    : `\nConvirtiendo ${aConvertir.length} conversacion${aConvertir.length === 1 ? "" : "es"}…`
);

/* ------------------------------------------------------------------ *
 * Convertir (o solo mirar)
 * ------------------------------------------------------------------ */

const salida = join(dirname(ruta), "convertido-" + aSalvo(basename(ruta).replace(/\.zip$/i, "")) + ".zip");

/* Se escribe directo al disco, sin montar el zip entero en memoria: un export
   con vídeos puede pesar gigas. */
const destino = soloLista
  ? null
  : new ZipWriter(Writable.toWeb(createWriteStream(salida)), { bufferedWrite: false });

const filas = [];
const yaPuestos = new Set();
let totalMensajes = 0;
let totalAdjuntos = 0;
let totalSinArchivo = 0;
let totalSinFecha = 0;
let vacias = 0;

for (let i = 0; i < aConvertir.length; i++) {
  const hilo = aConvertir[i];
  const nombre = comoNombre(hilo.carpeta);
  avance(`  ${i + 1}/${aConvertir.length} · ${nombre}`);

  const { paginas, informe } = await leerHilo(hilo);
  const { destinos, sinEncontrar, bytes } = dondeVaCadaAdjunto(informe, hilo.carpeta);
  reescribirAdjuntos(paginas, destinos);

  const mensajes = paginas.reduce((n, p) => n + (p.messages || []).length, 0);

  filas.push({
    hilo,
    nombre,
    mensajes,
    adjuntos: destinos.size,
    sinEncontrar: sinEncontrar.length,
    /* Lo que va a pesar dentro del zip convertido: las páginas no van. */
    bytes: bytes + mensajes * 200,
  });

  totalMensajes += mensajes;
  totalAdjuntos += destinos.size;
  totalSinArchivo += sinEncontrar.length;
  totalSinFecha += informe.sinFecha;

  /* Una conversación de la que no se reconoció ni un mensaje no entra: una
     carpeta vacía dentro del zip solo sirve para confundir al elegir. */
  if (mensajes === 0) {
    vacias++;
    continue;
  }
  if (!destino) continue;

  for (let p = 0; p < paginas.length; p++) {
    const json = JSON.stringify(aFormatoMeta(paginas[p], utf8));
    await destino.add(`${hilo.carpeta}/message_${p + 1}.json`, new TextReader(json));
  }

  /* Lo adjunto va tal cual. Sin comprimir: una foto o un vídeo ya vienen
     comprimidos y volver a intentarlo solo gasta tiempo.
     Las páginas .html NO se copian, a propósito: si quedara una, la aplicación
     vería el export como de los de HTML y volvería a rechazarlo. */
  for (const { entrada, destino: dentroDelZip } of destinos.values()) {
    if (yaPuestos.has(dentroDelZip)) continue;
    yaPuestos.add(dentroDelZip);
    const datos = await entrada.getData(new BlobWriter());
    await destino.add(dentroDelZip, new BlobReader(datos), { level: 0 });
  }

  /* Y lo que estuviera en la carpeta de la conversación sin que ninguna página
     lo enlazara: si no se reconoció el enlace, mejor que el archivo viaje a que
     se quede fuera. */
  for (const entrada of hilo.otros) {
    if (yaPuestos.has(entrada.filename)) continue;
    yaPuestos.add(entrada.filename);
    const datos = await entrada.getData(new BlobWriter());
    await destino.add(entrada.filename, new BlobReader(datos), { level: 0 });
  }
}

if (destino) await destino.close();
await zip.close();

/* ------------------------------------------------------------------ *
 * El informe
 * ------------------------------------------------------------------ */

console.log("\nCONVERSACIONES:", filas.length, "\n");
filas.forEach((f, i) => {
  const bandeja = (f.hilo.carpeta.match(/(^|\/)messages\/([^/]+)\//i) || [])[2] || "";
  const cola = [
    f.adjuntos ? f.adjuntos + (f.adjuntos === 1 ? " adjunto" : " adjuntos") : "",
    f.sinEncontrar ? f.sinEncontrar + " sin archivo en el zip" : "",
    bandeja && bandeja !== "inbox" ? bandeja : "",
    f.mensajes === 0 ? "SIN MENSAJES RECONOCIBLES: fuera del zip" : "",
  ].filter(Boolean);
  console.log(
    (
      "  " +
      /* El número es el de la lista entera, no el de esta tanda: es el que
         vale para --hilo. */
      String(lista.indexOf(f.hilo) + 1).padStart(3) +
      ". " +
      f.nombre.padEnd(32).slice(0, 32) +
      " " +
      String(f.mensajes).padStart(6) +
      (f.mensajes === 1 ? " mensaje " : " mensajes") +
      " · " +
      enMb(f.bytes).padStart(9) +
      (cola.length ? " · " + cola.join(" · ") : "")
    ).trimEnd()
  );
});

console.log("\n" + "-".repeat(64));
console.log("mensajes en total:", totalMensajes);
if (totalAdjuntos) console.log("adjuntos copiados:", totalAdjuntos);
if (totalSinArchivo) {
  console.log(
    "adjuntos que no están en el zip:",
    totalSinArchivo,
    "(se nombran en el chat, pero el archivo no viene en la descarga)"
  );
}
if (totalSinFecha) {
  console.log(
    "mensajes sin fecha legible:",
    totalSinFecha,
    "(se quedan junto al mensaje anterior, no al principio)"
  );
}
if (vacias) console.log("conversaciones sin ningún mensaje reconocible:", vacias);

if (soloLista) {
  console.log(
    [
      "",
      "No se ha convertido nada: esto solo ha leído el zip. Para convertirlo:",
      "",
      '  node herramientas/convertir-instagram-html.mjs "' + ruta + '"',
    ].join("\n")
  );
} else if (totalMensajes === 0) {
  console.log("\nNo se reconoció ningún mensaje, así que el zip de salida no sirve de nada.");
  process.exit(1);
} else {
  console.log(
    [
      "",
      "Listo → " + salida + " · " + enMb(statSync(salida).size),
      "",
      "Ese zip es el que se sube a BackupReader. Al subirlo te enseña la lista",
      "de conversaciones y eliges cuál abrir, igual que con una descarga en",
      "JSON. El original no se ha tocado.",
    ].join("\n")
  );
}

/** Un nombre de archivo que no se pelee con el sistema. */
function aSalvo(nombre) {
  return (
    String(nombre)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "instagram"
  );
}
