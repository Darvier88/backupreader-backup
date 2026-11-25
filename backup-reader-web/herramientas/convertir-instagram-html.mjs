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

/* Lo que acompaña a cada conversación: las fotos, los vídeos y los audios. */
const carpetas = [...hilos.keys()];
for (const entrada of entradas) {
  if (entrada.directory) continue;
  const carpeta = carpetas.find((c) => entrada.filename.startsWith(c + "/"));
  if (!carpeta) continue;
  const hilo = hilos.get(carpeta);
  hilo.bytes += entrada.uncompressedSize || 0;
  if (!ES_PAGINA.test(entrada.filename)) hilo.otros.push(entrada);
}

/* Las páginas, de la 1 en adelante: la 1 es el bloque más reciente, igual que
   en el export de JSON. */
for (const hilo of hilos.values()) {
  hilo.paginas.sort(
    (a, b) => Number(a.filename.match(ES_PAGINA)[2]) - Number(b.filename.match(ES_PAGINA)[2])
  );
}

/* De la más pesada a la más ligera, que es como se busca la de uno. */
const lista = [...hilos.values()].sort((a, b) => b.bytes - a.bytes);

const comoNombre = (carpeta) =>
  (carpeta.split("/").pop() || carpeta).replace(/_\d{5,}$/, "") || carpeta;

const enMb = (b) => (b / 1e6).toFixed(b < 10e6 ? 1 : 0) + " MB";

/* ------------------------------------------------------------------ *
 * Sin --hilo: solo se enseña lo que hay
 * ------------------------------------------------------------------ */

if (!todas && pedidos.length === 0) {
  console.log("\nCONVERSACIONES EN ESTE EXPORT:", lista.length, "\n");
  lista.forEach((h, i) => {
    const bandeja = (h.carpeta.match(/(^|\/)messages\/([^/]+)\//i) || [])[2] || "";
    console.log(
      "  " + String(i + 1).padStart(3) + ".",
      comoNombre(h.carpeta).padEnd(32).slice(0, 32),
      enMb(h.bytes).padStart(9),
      "·",
      String(h.paginas.length).padStart(3),
      h.paginas.length === 1 ? "página " : "páginas",
      bandeja && bandeja !== "inbox" ? "· " + bandeja : ""
    );
  });
  console.log(
    [
      "",
      "Para convertir una, su número:",
      "",
      '  node herramientas/convertir-instagram-html.mjs "' + ruta + '" --hilo 1',
      "",
      "Nada se ha leído todavía: esto solo ha mirado el índice del zip.",
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
  const paginasHtml = [];
  for (const entrada of hilo.paginas) {
    process.stdout.write("  leyendo " + basename(entrada.filename) + "\r");
    paginasHtml.push(await entrada.getData(new TextWriter()));
  }

  const { paginas, informe } = hiloDeHtml(paginasHtml, {
    rutaHilo: hilo.carpeta,
    carpeta: nombre,
  });

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

  /* 2. Escribir el zip. Se escribe directo al disco, sin montarlo entero en
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
  for (const entrada of hilo.otros) {
    process.stdout.write("  copiando adjuntos " + ++copiados + "/" + hilo.otros.length + "\r");
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
