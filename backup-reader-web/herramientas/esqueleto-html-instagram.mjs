/**
 * Saca el ESQUELETO del HTML de un export de Instagram, sin su contenido.
 *
 * PARA QUÉ
 * --------
 * Para poder escribir un conversor de HTML a JSON hace falta ver cómo está
 * montada la página: qué etiquetas y qué clases envuelven el nombre, el texto
 * y la fecha de cada mensaje. Eso no se puede adivinar, y pedir el HTML
 * entero sería pedir las conversaciones.
 *
 * Esto deja solo la estructura:
 *
 *   - El texto entre etiquetas se sustituye por «·12·», su longitud.
 *   - Los valores de los atributos se vacían, salvo `class`, que es lo único
 *     que hace falta para localizar las piezas. Así no salen ni nombres de
 *     archivo ni enlaces.
 *   - Se recorta a los primeros bloques, que ya enseñan el patrón que se
 *     repite.
 *
 * Lo único que se deja tal cual son las fechas, y solo si aparecen con un
 * formato reconocible, porque hay que saber cómo las escribe Instagram para
 * poder leerlas. Una fecha no dice nada de lo que hablaste.
 *
 * CÓMO SE USA
 * -----------
 *   node herramientas/esqueleto-html-instagram.mjs "C:\\ruta\\instagram.zip"
 *
 * Deja `esqueleto-instagram.txt` al lado del zip. Míralo antes de mandarlo.
 */

import { openAsBlob, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { BlobReader, ZipReader, TextWriter } from "@zip.js/zip.js";

const ruta = process.argv[2];
if (!ruta) {
  console.error('Falta el zip. Ejemplo:\n  node herramientas/esqueleto-html-instagram.mjs "C:\\\\ruta\\\\instagram.zip"');
  process.exit(1);
}

/* Fechas: se conservan porque hay que saber cómo vienen escritas. El resto
   del texto, no. */
const PARECE_FECHA = new RegExp(
  "\\b(" +
    /* «25 nov 2026», «25 de noviembre de 2026» */
    "\\d{1,2}\\s+(?:de\\s+)?[a-zA-Zá-úÁ-Ú]{3,12}\\.?\\s*(?:de\\s+)?\\d{4}" +
    "|" +
    /* «Nov 25, 2026» */
    "[a-zA-Zá-úÁ-Ú]{3,12}\\.?\\s+\\d{1,2},?\\s+\\d{4}" +
    "|" +
    /* «25/11/2026» */
    "\\d{1,2}[/-]\\d{1,2}[/-]\\d{2,4}" +
  ")[^<]{0,28}",
  "i"
);

const fuente = typeof openAsBlob === "function"
  ? await openAsBlob(ruta)
  : new Blob([readFileSync(ruta)]);
const zip = new ZipReader(new BlobReader(fuente));
const entradas = await zip.getEntries();

const html = entradas
  .filter((e) => /(^|\/)messages\/.*message_\d+\.html$/i.test(e.filename))
  .sort((a, b) => (a.uncompressedSize || 0) - (b.uncompressedSize || 0))[0];

if (!html) {
  console.error("No hay ningún message_N.html bajo messages/ en ese zip.");
  process.exit(1);
}

const crudo = await html.getData(new TextWriter());

/* 1. Atributos: se vacían todos menos class. `src` y `href` llevan nombres de
      archivo y enlaces, y eso no hace falta para nada. */
let esqueleto = crudo.replace(/(\w[\w-]*)="[^"]*"/g, (todo, attr) =>
  attr.toLowerCase() === "class" ? todo : `${attr}=""`
);

/* 2. Texto entre etiquetas: se cambia por su longitud, salvo si parece una
      fecha. */
esqueleto = esqueleto.replace(/>([^<]+)</g, (_todo, texto) => {
  const t = texto.trim();
  if (!t) return "><";
  const fecha = t.match(PARECE_FECHA);
  if (fecha) return `>FECHA(${JSON.stringify(fecha[0].trim())})<`;
  return `>·${t.length}·<`;
});

/* 3. Un trozo: el patrón de un mensaje se repite, así que con el principio
      basta. */
const TROZO = 14000;
const recorte = esqueleto.slice(0, TROZO);

const salida = join(dirname(ruta), "esqueleto-instagram.txt");
writeFileSync(
  salida,
  [
    "ESQUELETO DEL HTML DE UN EXPORT DE INSTAGRAM",
    "archivo: " + basename(html.filename) + " (" + (html.uncompressedSize || 0) + " bytes)",
    "archivos .html de mensajes en el zip: " +
      entradas.filter((e) => /message_\d+\.html$/i.test(e.filename)).length,
    "",
    "El texto está sustituido por su longitud (·N·). Los atributos están",
    "vacíos salvo class. Las fechas se conservan a propósito: hay que saber",
    "cómo las escribe Instagram para poder leerlas.",
    "",
    "----- primeros " + TROZO + " caracteres -----",
    recorte,
  ].join("\n"),
  "utf8"
);

await zip.close();

console.log("Esqueleto escrito en:", salida);
console.log("Tamaño:", recorte.length, "caracteres. Míralo antes de mandarlo.");
