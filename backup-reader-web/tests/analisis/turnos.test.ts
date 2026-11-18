import { describe, expect, it } from "vitest";
import { contables, normalizar } from "../../lib/analisis/normalizar";
import {
  agruparEnTurnos,
  mediana,
  medianaDePalabrasPorTurno,
} from "../../lib/analisis/turnos";
import { ANDROID_DIA_PRIMERO, CON_TODO, GRUPO, RAFAGAS, filasDe } from "./ejemplos";

const turnosDe = (texto: string) => agruparEnTurnos(contables(normalizar(filasDe(texto))));

describe("agruparEnTurnos", () => {
  it("junta los mensajes seguidos de la misma persona", () => {
    const turnos = turnosDe(ANDROID_DIA_PRIMERO);
    /* Ana, Beto, Ana (dos mensajes), Beto, Ana, Beto */
    expect(turnos.map((t) => t.autor)).toEqual(["Ana", "Beto", "Ana", "Beto", "Ana", "Beto"]);
    expect(turnos[2].mensajes).toHaveLength(2);
  });

  it("una ráfaga de cinco mensajes es un solo turno", () => {
    const turnos = turnosDe(RAFAGAS);
    expect(turnos).toHaveLength(2);
    expect(turnos[0].autor).toBe("Ana");
    expect(turnos[0].mensajes).toHaveLength(5);
  });

  it("el turno guarda el principio y el final de verdad", () => {
    const turnos = turnosDe(RAFAGAS);
    expect(turnos[0].inicio.getMinutes()).toBe(0);
    expect(turnos[0].fin.getMinutes()).toBe(1);
    expect(turnos[0].fin.getTime()).toBeGreaterThanOrEqual(turnos[0].inicio.getTime());
  });

  it("suma las palabras de todos los mensajes del turno", () => {
    const turnos = turnosDe(RAFAGAS);
    const suma = turnos[0].mensajes.reduce((n, m) => n + m.palabras, 0);
    expect(turnos[0].palabras).toBe(suma);
    expect(turnos[0].palabras).toBeGreaterThan(0);
  });

  it("no corta el turno aunque pasen horas sin que conteste el otro", () => {
    const turnos = agruparEnTurnos(
      contables(
        normalizar([
          ["13/01/26 9:00", "Ana", "hola"],
          ["14/01/26 18:00", "Ana", "¿sigues ahí?"],
          ["14/01/26 18:30", "Beto", "perdona"],
        ])
      )
    );
    expect(turnos).toHaveLength(2);
    expect(turnos[0].mensajes).toHaveLength(2);
  });

  it("los avisos del sistema y los eliminados no cortan ni crean turnos", () => {
    const turnos = turnosDe(CON_TODO);
    expect(turnos.every((t) => t.autor !== "")).toBe(true);
    expect(turnos.every((t) => t.mensajes.every((m) => m.tipo !== "eliminado"))).toBe(true);
  });

  it("en un grupo cada persona tiene sus turnos", () => {
    const turnos = turnosDe(GRUPO);
    expect(new Set(turnos.map((t) => t.autor))).toEqual(new Set(["Ana", "Beto", "Carla"]));
  });

  it("sin mensajes no hay turnos", () => {
    expect(agruparEnTurnos([])).toEqual([]);
  });
});

describe("mediana", () => {
  it("con un número impar de valores es el de en medio", () => {
    expect(mediana([3, 1, 2])).toBe(2);
  });

  it("con un número par es la media de los dos de en medio", () => {
    expect(mediana([1, 2, 3, 4])).toBe(2.5);
  });

  it("no cambia la lista que recibe", () => {
    const valores = [3, 1, 2];
    mediana(valores);
    expect(valores).toEqual([3, 1, 2]);
  });

  it("vacía es null", () => {
    expect(mediana([])).toBeNull();
  });
});

describe("medianaDePalabrasPorTurno", () => {
  it("una sola parrafada no mueve la cifra de quien escribe corto", () => {
    const turnos = agruparEnTurnos(
      contables(
        normalizar([
          ["13/01/26 9:00", "Ana", "vale"],
          ["13/01/26 9:01", "Beto", "ok"],
          ["13/01/26 9:02", "Ana", "sí"],
          ["13/01/26 9:03", "Beto", "ok"],
          ["13/01/26 9:04", "Ana", "bien"],
          ["13/01/26 9:05", "Beto", "ok"],
          [
            "13/01/26 9:06",
            "Ana",
            Array.from({ length: 400 }, (_, i) => `palabra${i}`).join(" "),
          ],
        ])
      )
    );
    const m = medianaDePalabrasPorTurno(turnos);
    expect(m.Ana).toBe(1);
    expect(m.Beto).toBe(1);
  });

  it("solo saca a quien tiene turnos", () => {
    expect(medianaDePalabrasPorTurno([])).toEqual({});
  });
});
