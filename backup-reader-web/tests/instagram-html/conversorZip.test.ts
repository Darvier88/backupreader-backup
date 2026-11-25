/**
 * El conversor, de punta a punta: se fabrica un export en HTML como el que
 * descarga Instagram, se convierte con el programa de verdad (como subproceso,
 * igual que lo correría una persona) y el zip que sale se lee con el código de
 * la aplicación.
 *
 * Lo que se comprueba aquí y no se puede comprobar en otro sitio:
 *   - Que el zip convertido NO parezca de los de HTML, o la aplicación lo
 *     volvería a rechazar.
 *   - Que las rutas de dentro sean las que el listador de conversaciones
 *     espera.
 *   - Que lo adjunto siga ahí y con su nombre.
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { BlobWriter, TextReader, Uint8ArrayReader, ZipWriter } from "@zip.js/zip.js";

import { openZip } from "../../lib/backupreader-crypto/zipStream";
import { hilosDeInstagram, esInstagramEnHtml } from "../../lib/backupreader-crypto/hilosInstagram";
import { parsearTextoInstagram } from "../../lib/parsear-instagram";

const RAIZ = "your_instagram_activity/messages/inbox";
const HILO = `${RAIZ}/anagarcia_1182939`;

const bloque = (autor: string, cuerpo: string, fecha: string) =>
  `<div class="pam _3-95 _2ph- _a6-g uiBoxWhite noborder">` +
  `<h2 class="_3-95 _2pim _a6-h _a6-i">${autor}</h2>` +
  `<div class="_3-95 _a6-p"><div><div></div><div>${cuerpo}</div><div></div><div></div></div></div>` +
  `<div class="_3-94 _a6-o">${fecha}</div>` +
  `</div>`;

const pagina = (bloques: string[]) =>
  `<html><head><meta http-equiv="Content-Type" content="text/html; charset=utf-8" />` +
  `<title>Instagram</title></head><body class="_5vb_ _2yq _a7o5"><div class="_li">` +
  `<div class="_a705"><header class="_as-_ _a70a"><div class="_a70d"><h1 id="">Ana García</h1>` +
  `<aside class="_aoaa">Descargado el <time datetime="">November 24, 2026 at 8:32 PM UTC</time></aside>` +
  `</div></header><main class="_a706" role="main">${bloques.join("")}</main>` +
  `</div></div></body></html>`;

/** El zip como Blob. `openAsBlob` no está en los tipos de Node 18, y aquí los
    archivos son de juguete: leerlos entero no cuesta nada. */
const comoBlob = (ruta: string) => new Blob([readFileSync(ruta)]);

const convertidos = () => readdirSync(carpeta).filter((f) => f.startsWith("convertido-"));

const convertir = (...extra: string[]) =>
  execFileSync("node", ["herramientas/convertir-instagram-html.mjs", origen, ...extra], {
    encoding: "utf8",
  });

let carpeta = "";
let origen = "";

describe("el conversor sobre un export en HTML", () => {
  beforeAll(async () => {
    carpeta = mkdtempSync(join(tmpdir(), "ig-html-"));
    origen = join(carpeta, "instagram-export.zip");

    const escritor = new ZipWriter(new BlobWriter("application/zip"));

    /* message_1.html es el bloque MÁS RECIENTE, y dentro va del más nuevo al
       más viejo. Así lo escribe Instagram. */
    await escritor.add(
      `${HILO}/message_1.html`,
      new TextReader(
        pagina([
          bloque(
            "Ana García",
            `mira esto<br><a href="${HILO}/photos/456.jpg"><img src="${HILO}/photos/456.jpg"/></a>`,
            "Sep 15, 2017 10:00 am"
          ),
          bloque("Luis Pérez", "¿nos vemos mañana?", "Sep 15, 2017 9:30 am"),
        ])
      )
    );
    await escritor.add(
      `${HILO}/message_2.html`,
      new TextReader(
        pagina([
          /* Sin acentos a propósito: así el emoji es lo único que no cabe en un
             byte, que es el caso en el que la codificación se rompía. */
          bloque("Ana García", "buenas noches 🌙", "Sep 14, 2017 11:00 pm"),
          bloque("Luis Pérez", "hola", "Sep 14, 2017 8:09 am"),
        ])
      )
    );
    /* Un adjunto de verdad, para ver que se copia con su nombre. */
    await escritor.add(
      `${HILO}/photos/456.jpg`,
      new Uint8ArrayReader(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]))
    );
    /* Otra conversación, para que haya que elegir. */
    await escritor.add(
      `${RAIZ}/otracuenta_99887766/message_1.html`,
      new TextReader(pagina([bloque("Otra Cuenta", "hey", "Jan 2, 2020 1:00 pm")]))
    );

    const blob = await escritor.close();
    writeFileSync(origen, Buffer.from(await blob.arrayBuffer()));
  }, 30000);

  afterAll(() => {
    if (carpeta) rmSync(carpeta, { recursive: true, force: true });
  });

  it("la aplicación rechaza el export original por venir en HTML", async () => {
    expect(await esInstagramEnHtml(comoBlob(origen))).toBe(true);
  });

  it("sin pedir nada, enseña las conversaciones y no escribe ningún zip", () => {
    const salida = convertir();
    expect(salida).toContain("CONVERSACIONES EN ESTE EXPORT: 2");
    expect(salida).toContain("anagarcia");
    expect(convertidos()).toHaveLength(0);
  }, 60000);

  it("convierte, y lo que sale ya no parece HTML", async () => {
    expect(convertir("--hilo", "1")).toContain("mensajes: 4");

    const hechos = convertidos();
    expect(hechos).toHaveLength(1);

    const zip = await openZip(comoBlob(join(carpeta, hechos[0])));
    const nombres = zip.entries.map((e) => e.name);
    await zip.close();

    /* Lo que más importa: ni una página .html dentro. Con una sola que quedara,
       la aplicación volvería a decir que el export es de los de HTML y no lo
       abriría. */
    expect(nombres.some((n) => n.endsWith(".html"))).toBe(false);
    expect(await esInstagramEnHtml(comoBlob(join(carpeta, hechos[0])))).toBe(false);

    expect(nombres).toContain(`${HILO}/message_1.json`);
    expect(nombres).toContain(`${HILO}/message_2.json`);
    expect(nombres).toContain(`${HILO}/photos/456.jpg`);
    /* La otra conversación no se pidió, así que no está. */
    expect(nombres.some((n) => n.includes("otracuenta"))).toBe(false);
  }, 60000);

  it("el listador de conversaciones lo lee como una conversación con su nombre", async () => {
    const hilos = await hilosDeInstagram(comoBlob(join(carpeta, convertidos()[0])));

    expect(hilos).toHaveLength(1);
    expect(hilos[0].nombre).toBe("Ana García");
    expect(hilos[0].participantes.slice().sort()).toEqual(["Ana García", "Luis Pérez"]);
    expect(hilos[0].prefijo).toBe(HILO + "/");
    expect(hilos[0].bandeja).toBe("inbox");
  }, 60000);

  it("los mensajes salen en orden, con sus acentos, sus emojis y su adjunto", async () => {
    const zip = await openZip(comoBlob(join(carpeta, convertidos()[0])));

    const textos: string[] = [];
    for (const nombre of [`${HILO}/message_1.json`, `${HILO}/message_2.json`]) {
      const entrada = zip.entries.find((e) => e.name === nombre);
      expect(entrada, nombre).toBeTruthy();
      textos.push(await (await entrada!.getBlob()).text());
    }
    await zip.close();

    const filas = parsearTextoInstagram(textos);

    expect(filas.map((f) => f[2])).toEqual([
      "hola",
      "buenas noches 🌙",
      "¿nos vemos mañana?",
      "mira esto <adjunto: 456.jpg>",
    ]);
    expect(filas.map((f) => f[1])).toEqual([
      "Luis Pérez",
      "Ana García",
      "Luis Pérez",
      "Ana García",
    ]);
    expect(filas[0][0]).toBe("2017-09-14 08:09");
    expect(filas[1][0]).toBe("2017-09-14 23:00");
    expect(filas[3][0]).toBe("2017-09-15 10:00");
  }, 60000);

  it("--todas saca una por conversación", () => {
    convertir("--todas");
    const hechos = convertidos();
    expect(hechos).toHaveLength(2);
    expect(hechos.some((f) => f.includes("otracuenta"))).toBe(true);
  }, 60000);
});
