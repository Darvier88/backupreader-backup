import { describe, it, expect } from "vitest";

import { medirFuerza, coinciden, MIN_LARGO } from "../../lib/fuerza-de-clave";

/**
 * El medidor de fuerza de la clave de cifrado.
 *
 * Lo que importa comprobar: que el mínimo siga bloqueando, que una clave larga
 * pero tonta se avise en vez de bloquearse, y que una frase larga en
 * minúsculas no salga peor que ocho caracteres con símbolos. Esto último es lo
 * que distingue un medidor útil de uno que empuja a escribir claves que nadie
 * recuerda.
 */

describe("medirFuerza", () => {
  it("por debajo del mínimo no se puede guardar", () => {
    expect(medirFuerza("corta").valida).toBe(false);
    expect(medirFuerza("a".repeat(MIN_LARGO - 1)).valida).toBe(false);
    expect(medirFuerza("corta").nivel).toBe("corta");
  });

  it("vacía puntúa cero, para que la barra arranque apagada", () => {
    expect(medirFuerza("").puntos).toBe(0);
  });

  it("justo en el mínimo ya se puede guardar", () => {
    expect(medirFuerza("perrogato1").valida).toBe(true);
  });

  it("UNA FRASE LARGA EN MINÚSCULAS NO ES PEOR QUE OCHO SÍMBOLOS", () => {
    /* Si el medidor premiara la variedad por encima de la longitud, empujaría
       a claves que nadie recuerda, y esta clave no se puede recuperar. */
    const frase = medirFuerza("el perro de mi abuela ladra");
    const simbolos = medirFuerza("aB3$xY7!zz");
    expect(frase.puntos).toBeGreaterThanOrEqual(simbolos.puntos);
    expect(frase.nivel).toBe("excelente");
  });

  it("una clave larga pero toda igual AVISA, no bloquea", () => {
    /* Bloquear aquí solo consigue que el usuario escriba otra cosa que
       tampoco recuerda. */
    const r = medirFuerza("aaaaaaaaaaaaaa");
    expect(r.nivel).toBe("simple");
    expect(r.valida).toBe(true);
  });

  it("detecta secuencias obvias aunque sean largas", () => {
    expect(medirFuerza("1234567890").nivel).toBe("simple");
    expect(medirFuerza("abcdefghij").nivel).toBe("simple");
    expect(medirFuerza("qwertyuiop").nivel).toBe("simple");
  });

  it("sube de nivel al añadir longitud", () => {
    const a = medirFuerza("perrogato1");
    const b = medirFuerza("perrogatoconejo");
    const c = medirFuerza("perrogatoconejoloro");
    expect(b.puntos).toBeGreaterThanOrEqual(a.puntos);
    expect(c.puntos).toBeGreaterThanOrEqual(b.puntos);
  });

  it("la variedad también cuenta", () => {
    expect(medirFuerza("perrogato1").puntos).toBeLessThan(
      medirFuerza("PerroGato1!").puntos
    );
  });

  it("nunca pasa de 4 puntos, que es lo que pinta la barra", () => {
    expect(medirFuerza("x".repeat(200) + "A1!").puntos).toBeLessThanOrEqual(4);
  });
});

describe("coinciden", () => {
  it("dice que sí solo cuando son iguales y hay algo escrito", () => {
    expect(coinciden("perrogato1", "perrogato1")).toBe(true);
    expect(coinciden("perrogato1", "perrogato2")).toBe(false);
  });

  it("con la segunda vacía dice que NO, no que sí", () => {
    /* Con dos campos vacíos son iguales, pero enseñar «las claves coinciden»
       antes de escribir nada es un visto bueno a nada. */
    expect(coinciden("", "")).toBe(false);
    expect(coinciden("perrogato1", "")).toBe(false);
  });

  it("no ignora espacios ni mayúsculas: la clave es literal", () => {
    expect(coinciden("Perro Gato", "perro gato")).toBe(false);
    expect(coinciden("perrogato ", "perrogato")).toBe(false);
  });
});
