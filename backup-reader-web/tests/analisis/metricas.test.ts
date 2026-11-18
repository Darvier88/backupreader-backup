import { describe, expect, it } from "vitest";
import { contables, normalizar } from "../../lib/analisis/normalizar";
import { agruparEnTurnos } from "../../lib/analisis/turnos";
import { escribeMas } from "../../lib/analisis/escribeMas";
import { iniciaMas, partirEnConversaciones } from "../../lib/analisis/iniciaMas";
import { tiempoDeRespuesta } from "../../lib/analisis/tiempoDeRespuesta";
import { actividad } from "../../lib/analisis/actividad";
import { tendencias } from "../../lib/analisis/tendencias";
import { compararDuraciones, compararReparto } from "../../lib/analisis/umbrales";
import { RAFAGAS, filasDe } from "./ejemplos";

const MINUTO = 60 * 1000;
const HORA = 60 * MINUTO;

/** Atajo: filas sueltas → mensajes contables. */
const mensajesDe = (filas: string[][]) => contables(normalizar(filas));
const turnosDe = (filas: string[][]) => agruparEnTurnos(mensajesDe(filas));

/** Construye filas a partir de minutos desde el 13/01/26 a las 9:00. */
function cronologia(pasos: Array<[minutos: number, autor: string, texto: string]>) {
  const base = new Date(2026, 0, 13, 9, 0, 0);
  return pasos.map(([minutos, autor, texto]) => {
    const d = new Date(base.getTime() + minutos * MINUTO);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return [`${dd}/${mm}/26 ${hh}:${mi}`, autor, texto];
  });
}

describe("compararReparto", () => {
  it("llama parecido a lo que está dentro del margen", () => {
    expect(compararReparto("Ana", 52, "Beto", 48)).toEqual({ mayor: null, parecido: true });
  });

  it("saca un nombre cuando la diferencia se nota", () => {
    expect(compararReparto("Ana", 70, "Beto", 30)).toEqual({ mayor: "Ana", parecido: false });
    expect(compararReparto("Ana", 30, "Beto", 70)).toEqual({ mayor: "Beto", parecido: false });
  });

  it("sin datos no dice nada", () => {
    expect(compararReparto("Ana", 0, "Beto", 0)).toEqual({ mayor: null, parecido: true });
  });
});

describe("compararDuraciones", () => {
  it("un minuto de diferencia al contestar no es una diferencia", () => {
    const r = compararDuraciones("Ana", 2 * MINUTO, "Beto", 3 * MINUTO, { suelo: MINUTO });
    expect(r.parecido).toBe(true);
  });

  it("el triple sí lo es", () => {
    const r = compararDuraciones("Ana", 30 * MINUTO, "Beto", 2 * MINUTO, { suelo: MINUTO });
    expect(r).toEqual({ mayor: "Ana", parecido: false });
  });
});

describe("escribeMas", () => {
  it("separa mensajes de palabras: quien manda fotos tiene muchos mensajes y pocas palabras", () => {
    const filas = cronologia([
      [0, "Ana", "IMG-1.jpg (archivo adjunto)"],
      [1, "Ana", "IMG-2.jpg (archivo adjunto)"],
      [2, "Ana", "IMG-3.jpg (archivo adjunto)"],
      [3, "Beto", "qué fotos tan bonitas has hecho hoy en el campo"],
    ]);
    const v = escribeMas(mensajesDe(filas));
    const ana = v.porAutor.find((a) => a.autor === "Ana")!;
    const beto = v.porAutor.find((a) => a.autor === "Beto")!;

    expect(ana.mensajes).toBe(3);
    expect(ana.palabras).toBe(0);
    expect(beto.mensajes).toBe(1);
    expect(beto.palabras).toBeGreaterThan(0);
    expect(v.masMensajes.mayor).toBe("Ana");
    expect(v.masPalabras.mayor).toBe("Beto");
  });

  it("dice «parecido» cuando los dos escriben casi lo mismo", () => {
    const filas = cronologia([
      [0, "Ana", "una dos tres cuatro cinco"],
      [1, "Beto", "una dos tres cuatro cinco"],
      [2, "Ana", "seis"],
      [3, "Beto", "seis"],
    ]);
    const v = escribeMas(mensajesDe(filas));
    expect(v.masPalabras).toEqual({ mayor: null, parecido: true });
    expect(v.masMensajes).toEqual({ mayor: null, parecido: true });
  });

  it("los porcentajes suman cien", () => {
    const v = escribeMas(mensajesDe(filasDe(RAFAGAS)));
    const suma = v.porAutor.reduce((n, a) => n + a.porcentajeMensajes, 0);
    expect(Math.round(suma)).toBe(100);
  });

  it("en un grupo no hay veredicto de dos", () => {
    const filas = cronologia([
      [0, "Ana", "hola"],
      [1, "Beto", "hola"],
      [2, "Carla", "hola"],
    ]);
    const v = escribeMas(mensajesDe(filas));
    expect(v.porAutor).toHaveLength(3);
    expect(v.masPalabras.parecido).toBe(true);
    expect(v.masPalabras.mayor).toBeNull();
  });

  it("sin mensajes no se rompe", () => {
    const v = escribeMas([]);
    expect(v.porAutor).toEqual([]);
    expect(v.totalPalabras).toBe(0);
  });
});

describe("partirEnConversaciones", () => {
  const filas = cronologia([
    [0, "Ana", "hola"],
    [2, "Beto", "hola"],
    /* seis horas de silencio */
    [6 * 60 + 2, "Beto", "oye"],
    [6 * 60 + 10, "Ana", "dime"],
  ]);

  it("un silencio mayor que el umbral abre una conversación nueva", () => {
    const c = partirEnConversaciones(mensajesDe(filas), 4);
    expect(c).toHaveLength(2);
    expect(c.map((x) => x.inicia)).toEqual(["Ana", "Beto"]);
  });

  it("con el umbral de ocho horas es una sola", () => {
    expect(partirEnConversaciones(mensajesDe(filas), 8)).toHaveLength(1);
  });

  it("el silencio se cuenta desde que el otro dejó de escribir", () => {
    /* Ana escribe durante dos horas; Beto contesta tres horas después del
       último mensaje de Ana. Con umbral de 4 h sigue siendo la misma. */
    const largo = cronologia([
      [0, "Ana", "uno"],
      [120, "Ana", "dos"],
      [300, "Beto", "perdona, ahora te leo"],
    ]);
    expect(partirEnConversaciones(mensajesDe(largo), 4)).toHaveLength(1);
  });

  it("sin mensajes no hay conversaciones", () => {
    expect(partirEnConversaciones([], 4)).toEqual([]);
  });
});

describe("iniciaMas", () => {
  it("cuenta quién rompe el silencio", () => {
    const filas = cronologia([
      [0, "Ana", "hola"],
      [5, "Beto", "hola"],
      [600, "Ana", "buenas"],
      [605, "Beto", "hey"],
      [1200, "Ana", "mira esto"],
      [1205, "Beto", "ja"],
    ]);
    const r = iniciaMas(mensajesDe(filas), 4);
    expect(r.conversaciones).toBe(3);
    /* Beto sale con cero, no se queda fuera: si no, el reparto diría que Ana
       es el 100 % de un único nombre y el titular acabaría en «parecido». */
    expect(r.porAutor).toEqual({ Ana: 3, Beto: 0 });
    expect(r.porcentajes).toEqual({ Ana: 100, Beto: 0 });
    expect(r.masInicios).toEqual({ mayor: "Ana", parecido: false });
  });

  it("reparte y compara cuando los dos empiezan", () => {
    const filas = cronologia([
      [0, "Ana", "a"],
      [5, "Beto", "b"],
      [600, "Beto", "c"],
      [605, "Ana", "d"],
    ]);
    const r = iniciaMas(mensajesDe(filas), 4);
    expect(r.porAutor).toEqual({ Ana: 1, Beto: 1 });
    expect(r.porcentajes).toEqual({ Ana: 50, Beto: 50 });
    expect(r.masInicios).toEqual({ mayor: null, parecido: true });
  });

  it("guarda el umbral con el que se calculó", () => {
    expect(iniciaMas(mensajesDe(filasDe(RAFAGAS)), 1).umbralHoras).toBe(1);
  });
});

describe("tiempoDeRespuesta", () => {
  it("mide desde que el otro terminó de escribir", () => {
    const filas = cronologia([
      [0, "Ana", "uno"],
      [1, "Ana", "dos"],
      [2, "Ana", "tres"],
      [12, "Beto", "ya voy"],
    ]);
    const r = tiempoDeRespuesta(turnosDe(filas), 4);
    const beto = r.porAutor.find((a) => a.autor === "Beto")!;
    /* Diez minutos desde el último mensaje de Ana, no doce desde el primero. */
    expect(beto.medianaMs).toBe(10 * MINUTO);
  });

  it("no cuenta como respuesta el mensaje que abre otra conversación", () => {
    const filas = cronologia([
      [0, "Ana", "hola"],
      [2, "Beto", "hola"],
      [600, "Ana", "buenas de nuevo"],
    ]);
    const r = tiempoDeRespuesta(turnosDe(filas), 4);
    expect(r.totalRespuestas).toBe(1);
    expect(r.porAutor.map((a) => a.autor)).toEqual(["Beto"]);
  });

  it("reparte las respuestas por tramos", () => {
    const filas = cronologia([
      [0, "Ana", "a"],
      [0, "Beto", "al instante"],
      [10, "Ana", "b"],
      [20, "Beto", "diez minutos"],
      [30, "Ana", "c"],
      [150, "Beto", "dos horas"],
    ]);
    const beto = tiempoDeRespuesta(turnosDe(filas), 8).porAutor.find(
      (a) => a.autor === "Beto"
    )!;
    expect(beto.respuestas).toBe(3);
    expect(beto.bajoUnMinuto).toBe(1);
    expect(beto.bajoUnaHora).toBe(1);
    expect(beto.masDeUnaHora).toBe(1);
  });

  it("dice «parecido» cuando la diferencia es de un minuto", () => {
    const filas = cronologia([
      [0, "Ana", "a"],
      [2, "Beto", "b"],
      [5, "Ana", "c"],
      [8, "Beto", "d"],
      [11, "Ana", "e"],
    ]);
    const r = tiempoDeRespuesta(turnosDe(filas), 4);
    expect(r.tardaMas.parecido).toBe(true);
  });

  it("saca un nombre cuando uno tarda mucho más", () => {
    const filas = cronologia([
      [0, "Ana", "a"],
      [1, "Beto", "b"],
      [2, "Ana", "c"],
      [62, "Beto", "perdona"],
      [63, "Ana", "d"],
      [123, "Beto", "otra vez perdona"],
      [124, "Ana", "e"],
    ]);
    const r = tiempoDeRespuesta(turnosDe(filas), 8);
    expect(r.tardaMas.mayor).toBe("Beto");
  });

  it("sin turnos no hay respuestas", () => {
    const r = tiempoDeRespuesta([], 4);
    expect(r.totalRespuestas).toBe(0);
    expect(r.porAutor).toEqual([]);
  });
});

describe("actividad", () => {
  const filas = [
    ["13/01/26 09:30", "Ana", "hola qué tal"],
    ["13/01/26 09:45", "Beto", "PTT-1.opus (archivo adjunto)"],
    ["13/01/26 23:10", "Ana", "buenas noches"],
    ["15/02/26 11:00", "Beto", "cuánto tiempo"],
  ];
  const a = actividad(mensajesDe(filas));

  it("reparte por hora del día", () => {
    expect(a.porHora).toHaveLength(24);
    expect(a.porHora[9].mensajes).toBe(2);
    expect(a.porHora[23].mensajes).toBe(1);
    expect(a.porHora[11].mensajes).toBe(1);
  });

  it("la semana empieza en lunes", () => {
    /* El 13/01/2026 es martes; el 15/02/2026, domingo. */
    expect(a.porDiaDeLaSemana[1].mensajes).toBe(3);
    expect(a.porDiaDeLaSemana[6].mensajes).toBe(1);
  });

  it("cuenta las notas de voz aparte", () => {
    expect(a.total.notasDeVoz).toBe(1);
    expect(a.porHora[9].notasDeVoz).toBe(1);
  });

  it("agrupa por mes en orden", () => {
    expect(a.porMes.map((m) => m.clave)).toEqual(["2026-01", "2026-02"]);
    expect(a.porMes[0].mensajes).toBe(3);
  });

  it("el mapa semanal es de 7 por 24", () => {
    expect(a.mapaSemanal).toHaveLength(7);
    expect(a.mapaSemanal[0]).toHaveLength(24);
    expect(a.mapaSemanal[1][9].mensajes).toBe(2);
  });

  it("sin mensajes todo a cero", () => {
    const vacia = actividad([]);
    expect(vacia.total).toEqual({ mensajes: 0, palabras: 0, notasDeVoz: 0 });
    expect(vacia.porMes).toEqual([]);
  });
});

describe("tendencias", () => {
  const meses = (valores: Array<[string, number]>) =>
    valores.map(([clave, mensajes]) => {
      const [anio, mes] = clave.split("-").map(Number);
      return { clave, anio, mes, mensajes, palabras: mensajes * 10, notasDeVoz: 0 };
    });

  it("rellena los meses sin nada para que el silencio se vea", () => {
    const t = tendencias(meses([["2026-01", 10], ["2026-04", 5]]));
    expect(t.serie.map((p) => p.clave)).toEqual([
      "2026-01",
      "2026-02",
      "2026-03",
      "2026-04",
    ]);
    expect(t.serie.map((p) => p.valor)).toEqual([10, 0, 0, 5]);
  });

  it("cruza el cambio de año", () => {
    const t = tendencias(meses([["2025-11", 1], ["2026-02", 1]]));
    expect(t.serie.map((p) => p.clave)).toEqual([
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
    ]);
  });

  it("encuentra el mes más activo", () => {
    const t = tendencias(meses([["2026-01", 10], ["2026-02", 40], ["2026-03", 5]]));
    expect(t.masActivo!.clave).toBe("2026-02");
  });

  it("compara los últimos meses con los anteriores", () => {
    const t = tendencias(
      meses([
        ["2026-01", 100],
        ["2026-02", 100],
        ["2026-03", 100],
        ["2026-04", 20],
        ["2026-05", 20],
        ["2026-06", 20],
      ])
    );
    expect(t.comparacion).toEqual({
      meses: 3,
      reciente: 20,
      anterior: 100,
      direccion: "menos",
    });
  });

  it("un cambio pequeño es «parecido»", () => {
    const t = tendencias(
      meses([
        ["2026-01", 100],
        ["2026-02", 100],
        ["2026-03", 100],
        ["2026-04", 105],
        ["2026-05", 100],
        ["2026-06", 95],
      ])
    );
    expect(t.comparacion!.direccion).toBe("parecido");
  });

  it("sin meses suficientes no compara", () => {
    expect(tendencias(meses([["2026-01", 10]])).comparacion).toBeNull();
  });

  it("puede medir palabras en vez de mensajes", () => {
    const t = tendencias(meses([["2026-01", 10], ["2026-02", 20]]), "palabras");
    expect(t.medida).toBe("palabras");
    expect(t.serie.map((p) => p.valor)).toEqual([100, 200]);
  });

  it("sin nada devuelve una serie vacía", () => {
    const t = tendencias([]);
    expect(t.serie).toEqual([]);
    expect(t.masActivo).toBeNull();
    expect(t.comparacion).toBeNull();
  });
});
