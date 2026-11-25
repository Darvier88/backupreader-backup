/**
 * Radiografía de un export de Instagram, SIN sacar las conversaciones de aquí.
 *
 * PARA QUÉ
 * --------
 * Para que alguien pueda contar qué trae su export sin tener que mandárselo a
 * nadie. Un export de Instagram son todas tus conversaciones privadas y pesa
 * gigas; mandarlo entero para que lo mire otro no es razonable ni seguro.
 *
 * Esto lee el zip en tu máquina y escribe un informe pequeño con la FORMA del
 * archivo: qué campos aparecen y cuántas veces, cuántas conversaciones hay y
 * de qué tamaño, y qué pinta tienen los avisos de grupo.
 *
 * QUÉ NO SALE EN EL INFORME
 * -------------------------
 * - Ningún mensaje tuyo. Del contenido solo se cuentan longitudes.
 * - Ningún nombre: los participantes salen como «P1», «P2»…, y dentro de los
 *   avisos de grupo se sustituyen por «NOMBRE».
 * - Ningún nombre de archivo ni enlace.
 *
 * Lo único que se transcribe son los avisos de grupo (quién entró, quién
 * salió, cambios de nombre), porque esa frase la escribe Instagram y no tú, y
 * es justo lo que hay que saber para no contarlos como mensajes de una
 * persona. Aun así se les quitan los nombres.
 *
 * CÓMO SE USA
 * -----------
 *   node herramientas/radiografia-instagram.mjs "C:\\ruta\\instagram.zip"
 *
 * Deja el informe en `radiografia-instagram.txt`, al lado del zip. Ábrelo,
 * míralo tú primero, y mándalo si te parece bien.
 */

import { openAsBlob, readFileSync, writeFileSync, statSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { BlobReader, ZipReader, TextWriter } from "@zip.js/zip.js";

const ruta = process.argv[2];
if (!ruta) {
  console.error('Falta el zip. Ejemplo:\n  node herramientas/radiografia-instagram.mjs "C:\\\\ruta\\\\instagram.zip"');
  process.exit(1);
}

const ES_MENSAJES = /(^|\/)message_\d+\.json$/i;

/* Lo que se busca: frases que escribe Instagram, no la gente. Varios idiomas
   porque el export sale en el idioma de la cuenta. */
const AVISO = /(a[ñn]adi[óo]|agreg[óo]|invit[óo]|sali[óo]|abandon[óo]|elimin[óo]|expuls[óo]|cambi[óo] el nombre|nombr[óo]|cre[óo] el grupo|added|removed|left|joined|named|created the group|changed the|set the)/i;

const informe = [];
const di = (...t) => { informe.push(t.join(" ")); console.log(...t); };

/* `openAsBlob` apunta al archivo sin leerlo entero: un export de Instagram
   puede pesar gigas, y cargarlo en memoria revienta antes de empezar. Si la
   versión de Node no lo tiene, se recurre a leerlo, que sirve para los
   pequeños. */
const fuente = typeof openAsBlob === "function"
  ? await openAsBlob(ruta)
  : new Blob([readFileSync(ruta)]);

const zip = new ZipReader(new BlobReader(fuente));
const entradas = await zip.getEntries();

di("RADIOGRAFÍA DE UN EXPORT DE INSTAGRAM");
di("zip:", basename(ruta), "·", (statSync(ruta).size / 1e9).toFixed(2), "GB", "·", entradas.length, "entradas");

/* Qué carpetas de primer nivel trae, para ver si el export es solo de
   mensajes o de la cuenta entera. */
const raices = new Map();
for (const e of entradas) {
  const r = e.filename.split("/").slice(0, 2).join("/");
  raices.set(r, (raices.get(r) || 0) + 1);
}
di("\nCARPETAS (las 12 mayores)");
[...raices.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)
  .forEach(([r, n]) => di("  ", n.toString().padStart(6), r));

/* Dónde están los mensajes y cómo se llaman esas carpetas. */
const archivos = entradas.filter((e) => ES_MENSAJES.test(e.filename));
di("\nARCHIVOS DE MENSAJES:", archivos.length);
const bandejas = new Set(
  archivos.map((e) => (e.filename.match(/(^|\/)messages\/([^/]+)\//i) || [])[2] || "(fuera de messages/)")
);
di("BANDEJAS:", [...bandejas].join(", "));

/* Las extensiones de lo adjunto, para saber si hay tipos que no mapeamos. */
const exts = new Map();
for (const e of entradas) {
  const m = e.filename.match(/\.([a-z0-9]{1,5})$/i);
  if (m) exts.set(m[1].toLowerCase(), (exts.get(m[1].toLowerCase()) || 0) + 1);
}
di("\nEXTENSIONES");
[...exts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)
  .forEach(([x, n]) => di("  ", n.toString().padStart(6), "." + x));

/* Por conversación: cuántos archivos de mensajes, cuántos mensajes, qué
   campos aparecen. Y los avisos de grupo, anonimizados. */
const porHilo = new Map();
for (const e of archivos) {
  const carpeta = e.filename.slice(0, e.filename.lastIndexOf("/"));
  if (!porHilo.has(carpeta)) porHilo.set(carpeta, []);
  porHilo.get(carpeta).push(e);
}

di("\nCONVERSACIONES:", porHilo.size);

const campos = new Map();
const clavesDeMensaje = new Map();
const avisos = new Map();
let totalMensajes = 0;
let conContenido = 0;
let sinNadaReconocible = 0;

const hilos = [...porHilo.entries()];
/* Se miran todas, pero el informe solo detalla las diez mayores. */
const detalle = [];

for (const [carpeta, trozos] of hilos) {
  let mensajes = [];
  let participantes = [];
  let titulo = "";
  for (const t of trozos) {
    try {
      const texto = await t.getData(new TextWriter());
      const d = JSON.parse(texto);
      for (const k of Object.keys(d)) campos.set(k, (campos.get(k) || 0) + 1);
      mensajes = mensajes.concat(d.messages || []);
      participantes = (d.participants || []).map((p) => p?.name).filter(Boolean);
      titulo = d.title || "";
    } catch {
      di("  (archivo ilegible en", carpeta.split("/").pop() + ")");
    }
  }

  const anon = new Map(participantes.map((n, i) => [n, "P" + (i + 1)]));
  const quitarNombres = (s) => {
    let r = s;
    for (const [n] of anon) if (n) r = r.split(n).join("NOMBRE");
    return r;
  };

  for (const m of mensajes) {
    totalMensajes++;
    for (const k of Object.keys(m)) clavesDeMensaje.set(k, (clavesDeMensaje.get(k) || 0) + 1);
    const c = (m.content || "").trim();
    if (c) conContenido++;
    if (
      !c && !m.photos && !m.videos && !m.audio_files && !m.gifs && !m.sticker && !m.share && !m.is_unsent
    ) {
      sinNadaReconocible++;
    }
    /* El aviso de grupo: frase corta, sin adjunto, que coincide con el patrón. */
    if (c && c.length < 140 && AVISO.test(c) && !m.photos && !m.videos && !m.audio_files) {
      const limpio = quitarNombres(c);
      avisos.set(limpio, (avisos.get(limpio) || 0) + 1);
    }
  }

  detalle.push({
    carpeta: carpeta.split("/").pop().replace(/_\d{5,}$/, "_ID"),
    bandeja: (carpeta.match(/messages\/([^/]+)\//i) || [])[1] || "?",
    archivos: trozos.length,
    mensajes: mensajes.length,
    participantes: participantes.length,
    tituloEsDeParticipante: participantes.includes(titulo),
  });
}

di("MENSAJES EN TOTAL:", totalMensajes);
di("  con texto:", conContenido);
di("  sin texto ni nada reconocible:", sinNadaReconocible, "(si esto es alto, se nos escapa algún tipo)");

di("\nCAMPOS DEL ARCHIVO (cuántos archivos los traen)");
[...campos.entries()].sort((a, b) => b[1] - a[1])
  .forEach(([k, n]) => di("  ", n.toString().padStart(6), k));

di("\nCAMPOS DE CADA MENSAJE (cuántos mensajes los traen)");
[...clavesDeMensaje.entries()].sort((a, b) => b[1] - a[1])
  .forEach(([k, n]) => di("  ", n.toString().padStart(6), k));

di("\nPOSIBLES AVISOS DE GRUPO, SIN NOMBRES (los 25 más repetidos)");
if (avisos.size === 0) di("   (ninguno: o no hay grupos, o Instagram no los escribe como mensaje)");
[...avisos.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25)
  .forEach(([t, n]) => di("  ", n.toString().padStart(5), "×", JSON.stringify(t)));

di("\nLAS DIEZ CONVERSACIONES MAYORES");
detalle.sort((a, b) => b.mensajes - a.mensajes).slice(0, 10).forEach((d) =>
  di(
    "  ",
    String(d.mensajes).padStart(7),
    "mensajes ·",
    d.archivos,
    "archivo(s) ·",
    d.participantes,
    "participantes ·",
    d.bandeja,
    "· título es un participante:",
    d.tituloEsDeParticipante ? "sí" : "no"
  )
);

await zip.close();

const salida = join(dirname(ruta), "radiografia-instagram.txt");
writeFileSync(salida, informe.join("\n") + "\n", "utf8");
console.log("\nInforme escrito en:", salida);
console.log("Míralo antes de mandarlo. No lleva mensajes ni nombres, pero es tuyo y lo decides tú.");
