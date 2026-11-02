#!/usr/bin/env node
/**
 * generar-iconos — rehace los favicons a partir de public/favicon.svg.
 *
 * Existe para que los iconos no sean archivos huérfanos que nadie sepa de
 * dónde salieron: si cambia la marca, se edita el SVG y se vuelve a correr
 * esto.
 *
 *   node herramientas/generar-iconos.mjs
 *
 * Necesita Chromium (ya viene con playwright) para rasterizar, e ImageMagick
 * (`convert`) para empaquetar el .ico.
 *
 * POR QUÉ CADA TAMAÑO
 *   16, 32   la pestaña del navegador
 *   48       lo que pide Google para el icono de los resultados de búsqueda:
 *            acepta cuadrados múltiplos de 48 y nada más
 *   180      apple-touch-icon, el que usa iOS al guardar en la pantalla de
 *            inicio; sobre fondo papel, porque iOS no respeta transparencia y
 *            un círculo transparente acaba recortado sobre negro
 *   192, 512 el manifiesto, para Android y para Chrome al instalar
 */

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

/* Playwright está instalado globalmente y se resuelve por CommonJS, no por
   ESM, así que un `import` normal no lo encuentra. */
const { chromium } = createRequire(import.meta.url)("playwright");

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const publico = join(raiz, "public");
const fuente = join(publico, "favicon.svg");

if (!existsSync(fuente)) {
  console.error("No encuentro public/favicon.svg");
  process.exit(1);
}

const svg = readFileSync(fuente, "utf8");
const PAPEL = "#FBF8F1"; // var(--paper-50)

/* Los que van sobre fondo papel llevan además un margen, porque iOS y Android
   recortan las esquinas y el círculo quedaría mordido. */
const SALIDAS = [
  { archivo: "favicon-16.png", lado: 16, fondo: null, margen: 0 },
  { archivo: "favicon-32.png", lado: 32, fondo: null, margen: 0 },
  { archivo: "favicon-48.png", lado: 48, fondo: null, margen: 0 },
  { archivo: "apple-touch-icon.png", lado: 180, fondo: PAPEL, margen: 0.12 },
  { archivo: "icon-192.png", lado: 192, fondo: PAPEL, margen: 0.1 },
  { archivo: "icon-512.png", lado: 512, fondo: PAPEL, margen: 0.1 },
];

const pagina = (lado, fondo, margen) => {
  const hueco = Math.round(lado * margen);
  const dentro = lado - hueco * 2;
  return `<!doctype html><meta charset="utf-8">
<style>
  html,body{margin:0;padding:0;width:${lado}px;height:${lado}px;overflow:hidden}
  body{background:${fondo ?? "transparent"};display:flex;align-items:center;justify-content:center}
  svg{width:${dentro}px;height:${dentro}px;display:block}
</style>${svg}`;
};

const navegador = await chromium.launch();
try {
  for (const { archivo, lado, fondo, margen } of SALIDAS) {
    const p = await navegador.newPage({
      viewport: { width: lado, height: lado },
      deviceScaleFactor: 1,
    });
    await p.setContent(pagina(lado, fondo, margen));
    const png = await p.screenshot({ omitBackground: !fondo, type: "png" });
    writeFileSync(join(publico, archivo), png);
    await p.close();
    console.log(`  ${archivo}  ${lado}x${lado}${fondo ? "  (fondo papel)" : ""}`);
  }
} finally {
  await navegador.close();
}

/* El .ico lleva los tres tamaños dentro: el navegador escoge el que le venga
   mejor, y el de 48 es el que mira Google. */
try {
  execFileSync("convert", [
    join(publico, "favicon-16.png"),
    join(publico, "favicon-32.png"),
    join(publico, "favicon-48.png"),
    join(publico, "favicon.ico"),
  ]);
  console.log("  favicon.ico  (16+32+48)");
} catch (err) {
  console.error("No se pudo crear el .ico; ¿está ImageMagick?", err.message);
  process.exitCode = 1;
}
