import { describe, it, expect, vi } from "vitest";

import {
  indexarPendientes,
  avisoDeBusqueda,
  estadoInicial,
  type EstadoIndexado,
} from "../../lib/busqueda/indexador";

/**
 * La pasada de indexado: progreso, reanudación y tolerancia a fallos.
 *
 * Lo importante que se comprueba: que un chat roto no deje sin búsqueda a toda
 * la cuenta, y que el estado nunca diga "completa" mientras falte algo. Lo
 * segundo es lo que evita que la búsqueda mienta.
 */

const sinEsperar = async () => {};

describe("indexarPendientes", () => {
  it("indexa todos los pendientes e informa del progreso", async () => {
    const vistos: string[] = [];
    const progresos: EstadoIndexado[] = [];

    const final = await indexarPendientes({
      pendientes: ["a", "b", "c"],
      total: 3,
      indexarUno: async (id) => {
        vistos.push(id);
      },
      onProgreso: (e) => progresos.push(e),
      esperar: sinEsperar,
    });

    expect(vistos).toEqual(["a", "b", "c"]);
    expect(final.hechos).toBe(3);
    expect(final.fallidos).toBe(0);
    expect(final.corriendo).toBe(false);
    expect(progresos.length).toBeGreaterThan(3);
  });

  it("CUENTA COMO HECHOS los que ya estaban indexados antes de empezar", async () => {
    /* Si arrancara el contador en cero, alguien con 40 de 42 chats indexados
       vería "0 de 42" al volver a entrar y pensaría que se perdió el trabajo. */
    const final = await indexarPendientes({
      pendientes: ["z"],
      total: 10,
      indexarUno: async () => {},
      onProgreso: () => {},
      esperar: sinEsperar,
    });

    expect(final.hechos).toBe(10);
  });

  it("UN CHAT ROTO NO DETIENE LA PASADA", async () => {
    /* Un backup ilegible no puede dejar sin indexar a los otros cuarenta: si
       lo hiciera, un solo chat roto inutilizaría la búsqueda de la cuenta. */
    const vistos: string[] = [];

    const final = await indexarPendientes({
      pendientes: ["a", "roto", "c"],
      total: 3,
      indexarUno: async (id) => {
        vistos.push(id);
        if (id === "roto") throw new Error("manifiesto ilegible");
      },
      onProgreso: () => {},
      esperar: sinEsperar,
    });

    expect(vistos).toEqual(["a", "roto", "c"]);
    expect(final.hechos).toBe(2);
    expect(final.fallidos).toBe(1);
  });

  it("se puede abandonar a mitad, y lo hecho queda hecho", async () => {
    /* Es lo que pasa al bloquear la bóveda o cerrar sesión con la pasada en
       marcha: sin la DEK no se puede seguir descifrando. */
    const vistos: string[] = [];
    let parar = false;

    const final = await indexarPendientes({
      pendientes: ["a", "b", "c", "d"],
      total: 4,
      indexarUno: async (id) => {
        vistos.push(id);
        if (id === "b") parar = true;
      },
      onProgreso: () => {},
      debeParar: () => parar,
      esperar: sinEsperar,
    });

    expect(vistos).toEqual(["a", "b"]);
    expect(final.hechos).toBe(2);
    expect(final.corriendo).toBe(false);
  });

  it("va de uno en uno, no en paralelo", async () => {
    /* Descifrar es caro en CPU y compite con lo que el usuario está haciendo.
       En paralelo congelaría la pestaña, que es justo lo que el índice venía
       a evitar. */
    let simultaneos = 0;
    let maximo = 0;

    await indexarPendientes({
      pendientes: ["a", "b", "c"],
      total: 3,
      indexarUno: async () => {
        simultaneos++;
        maximo = Math.max(maximo, simultaneos);
        await Promise.resolve();
        simultaneos--;
      },
      onProgreso: () => {},
      esperar: sinEsperar,
    });

    expect(maximo).toBe(1);
  });

  it("hace una pausa entre chats", async () => {
    const esperar = vi.fn(async () => {});

    await indexarPendientes({
      pendientes: ["a", "b"],
      total: 2,
      indexarUno: async () => {},
      onProgreso: () => {},
      esperar,
      pausaMs: 50,
    });

    expect(esperar).toHaveBeenCalledTimes(2);
    expect(esperar).toHaveBeenCalledWith(50);
  });

  it("sin pendientes termina sin indexar nada", async () => {
    const indexarUno = vi.fn(async () => {});

    const final = await indexarPendientes({
      pendientes: [],
      total: 7,
      indexarUno,
      onProgreso: () => {},
      esperar: sinEsperar,
    });

    expect(indexarUno).not.toHaveBeenCalled();
    expect(final.hechos).toBe(7);
    expect(final.corriendo).toBe(false);
  });
});

describe("avisoDeBusqueda", () => {
  it("dice que está completa solo cuando no falta ninguno", () => {
    expect(avisoDeBusqueda({ ...estadoInicial, total: 5, hechos: 5 })).toEqual({
      clave: "completa",
    });
  });

  it("mientras indexa dice cuántos faltan", () => {
    expect(
      avisoDeBusqueda({ ...estadoInicial, total: 10, hechos: 4, corriendo: true })
    ).toEqual({ clave: "indexando", faltan: 6, total: 10 });
  });

  it("NO dice 'completa' cuando la pasada terminó dejando fallidos", () => {
    /* Este es el que importa. Si dijera que está completa, el usuario buscaría
       "Yuli", no vería nada, y concluiría que no existe ese mensaje. Una
       búsqueda lenta se espera; una que miente no se detecta nunca. */
    const aviso = avisoDeBusqueda({
      ...estadoInicial,
      total: 10,
      hechos: 8,
      fallidos: 2,
      corriendo: false,
    });

    expect(aviso).toEqual({ clave: "faltan-chats", faltan: 2 });
  });

  it("sin chats, está completa y no avisa de nada raro", () => {
    expect(avisoDeBusqueda(estadoInicial)).toEqual({ clave: "completa" });
  });
});
