/**
 * Que todos los avisos de error tengan traducción.
 *
 * Los textos son sus propias claves: el español está en el componente y el
 * inglés en `i18n.js`. Eso quiere decir que cambiar una coma en el componente
 * deja el inglés huérfano, y lo que se ve entonces no es un error ni una
 * pantalla rota, sino el texto en español dentro de la aplicación en inglés.
 * No falla nada, así que no se nota: por eso esta prueba.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const raiz = join(__dirname, "..", "..");
const componente = readFileSync(join(raiz, "components/ui/AvisoDeErrores.tsx"), "utf8");
const traducciones = readFileSync(join(raiz, "i18n.js"), "utf8");

/** Los literales que pasan por `t("…")`, que son las claves. */
function clavesDe(fuente: string): string[] {
  const claves = new Set<string>();
  const re = /\bt\(\s*"((?:[^"\\]|\\.)*)"/g;
  let m;
  while ((m = re.exec(fuente))) claves.add(m[1]);
  return [...claves];
}

describe("los avisos de error están traducidos", () => {
  const claves = clavesDe(componente);

  it("hay avisos que comprobar", () => {
    /* Si el componente cambia de forma y la extracción deja de encontrar
       nada, esta prueba pasaría vacía y no guardaría nada. */
    expect(claves.length).toBeGreaterThan(5);
  });

  it("cada texto tiene su versión en inglés", () => {
    const huerfanas = claves.filter((c) => !traducciones.includes('"' + c + '"'));
    expect(huerfanas, "sin traducir en i18n.js").toEqual([]);
  });

  it("el aviso del export en HTML dice dónde se elige el formato", () => {
    /* Es el caso que no se puede arreglar desde la aplicación: esta descarga
       ya no sirve y la siguiente tarda días. Si el aviso no dice dónde está la
       opción, la persona vuelve a pedir lo mismo y espera otra vez para nada. */
    const aviso = claves.find((c) => c.includes("páginas web"));
    expect(aviso, "falta el aviso del export en HTML").toBeTruthy();
    expect(aviso).toContain("JSON");
    expect(aviso).toContain("Descargar tu información");
  });
});
