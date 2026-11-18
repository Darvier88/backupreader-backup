import { describe, expect, it } from "vitest";
import { aMarcaDeTiempo, deducirFormato } from "../../lib/analisis/fechaHora";
import {
  AMBIGUO,
  ANDROID_DIA_PRIMERO,
  ANDROID_MES_PRIMERO,
  HORARIO_VERANO,
  IOS,
  filasDe,
} from "./ejemplos";

describe("deducirFormato", () => {
  it("ve el día delante cuando algún número pasa de 12", () => {
    expect(deducirFormato(filasDe(ANDROID_DIA_PRIMERO))).toEqual({
      diaPrimero: true,
      seguro: true,
    });
  });

  it("ve el mes delante en un export de EE. UU.", () => {
    expect(deducirFormato(filasDe(ANDROID_MES_PRIMERO))).toEqual({
      diaPrimero: false,
      seguro: true,
    });
  });

  it("entiende el formato de iPhone con corchetes y año de cuatro cifras", () => {
    expect(deducirFormato(filasDe(IOS))).toEqual({ diaPrimero: true, seguro: true });
  });

  it("si el chat no lo demuestra, usa el respaldo y lo marca como no seguro", () => {
    const filas = filasDe(AMBIGUO);
    expect(deducirFormato(filas, true)).toEqual({ diaPrimero: true, seguro: false });
    expect(deducirFormato(filas, false)).toEqual({ diaPrimero: false, seguro: false });
  });

  it("sin filas devuelve el respaldo", () => {
    expect(deducirFormato([], true)).toEqual({ diaPrimero: true, seguro: false });
  });

  it("si el export se contradice, gana la mayoría y deja de ser seguro", () => {
    const filas = [
      ["31/01/26 9:00", "Ana", "a"],
      ["28/01/26 9:00", "Ana", "b"],
      ["01/31/26 9:00", "Beto", "c"],
    ];
    expect(deducirFormato(filas)).toEqual({ diaPrimero: true, seguro: false });
  });
});

const DIA_PRIMERO = { diaPrimero: true, seguro: true };
const MES_PRIMERO = { diaPrimero: false, seguro: true };

describe("aMarcaDeTiempo", () => {
  it("guarda el día, el mes y la hora de un export día primero", () => {
    const d = aMarcaDeTiempo("13/01/26 14:30", DIA_PRIMERO)!;
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(0);
    expect(d.getDate()).toBe(13);
    expect(d.getHours()).toBe(14);
    expect(d.getMinutes()).toBe(30);
  });

  it("lee el mismo día en un export mes primero", () => {
    const d = aMarcaDeTiempo("01/13/26 9:00 AM", MES_PRIMERO)!;
    expect(d.getMonth()).toBe(0);
    expect(d.getDate()).toBe(13);
    expect(d.getHours()).toBe(9);
  });

  it("entiende AM y PM, incluidas las doce", () => {
    expect(aMarcaDeTiempo("03/04/26 12:05 AM", DIA_PRIMERO)!.getHours()).toBe(0);
    expect(aMarcaDeTiempo("03/04/26 12:05 PM", DIA_PRIMERO)!.getHours()).toBe(12);
    expect(aMarcaDeTiempo("03/04/26 1:05 PM", DIA_PRIMERO)!.getHours()).toBe(13);
    expect(aMarcaDeTiempo("03/04/26 11:05 p. m.", DIA_PRIMERO)!.getHours()).toBe(23);
  });

  it("guarda los segundos del formato de iPhone", () => {
    const d = aMarcaDeTiempo("13/01/2026 9:00:12", DIA_PRIMERO)!;
    expect(d.getFullYear()).toBe(2026);
    expect(d.getSeconds()).toBe(12);
  });

  it("entiende el formato con el año delante", () => {
    const d = aMarcaDeTiempo("2026-09-08 08:10", DIA_PRIMERO)!;
    expect(d.getMonth()).toBe(8);
    expect(d.getDate()).toBe(8);
    expect(d.getHours()).toBe(8);
  });

  it("una fila que se demuestra a sí misma manda sobre el formato del chat", () => {
    /* El chat es mes primero, pero aquí el 31 solo puede ser el día. */
    const d = aMarcaDeTiempo("31/01/26 9:00", MES_PRIMERO)!;
    expect(d.getDate()).toBe(31);
    expect(d.getMonth()).toBe(0);
  });

  it("descarta fechas imposibles en vez de moverlas de mes", () => {
    expect(aMarcaDeTiempo("31/02/26 9:00", DIA_PRIMERO)).toBeNull();
    expect(aMarcaDeTiempo("00/01/26 9:00", DIA_PRIMERO)).toBeNull();
    expect(aMarcaDeTiempo("13/13/26 9:00", DIA_PRIMERO)).toBeNull();
  });

  it("devuelve null cuando no hay fecha que leer", () => {
    expect(aMarcaDeTiempo("", DIA_PRIMERO)).toBeNull();
    expect(aMarcaDeTiempo(null, DIA_PRIMERO)).toBeNull();
    expect(aMarcaDeTiempo("hola", DIA_PRIMERO)).toBeNull();
  });

  it("sin hora deja el día a las 00:00", () => {
    const d = aMarcaDeTiempo("13/01/26", DIA_PRIMERO)!;
    expect(d.getDate()).toBe(13);
    expect(d.getHours()).toBe(0);
  });

  it("el año de dos cifras es de este siglo", () => {
    expect(aMarcaDeTiempo("13/01/26 9:00", DIA_PRIMERO)!.getFullYear()).toBe(2026);
    expect(aMarcaDeTiempo("13/01/2026 9:00", DIA_PRIMERO)!.getFullYear()).toBe(2026);
  });

  it("el cambio de horario de verano no mueve mensajes de día ni los desordena", () => {
    const filas = filasDe(HORARIO_VERANO);
    const fechas = filas.map((f) => aMarcaDeTiempo(f[0], DIA_PRIMERO)!);

    expect(fechas.every(Boolean)).toBe(true);
    expect(fechas.map((d) => d.getDate())).toEqual([28, 29, 29, 29]);
    /* Siguen en orden: nada se adelanta al cruzar la noche del cambio. */
    for (let i = 1; i < fechas.length; i++) {
      expect(fechas[i].getTime()).toBeGreaterThan(fechas[i - 1].getTime());
    }
  });
});
