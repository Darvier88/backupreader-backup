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

/* ---------- lo que pedía el diseño: cubos, meses a medias y 5 minutos ---------- */

describe("mapa por cubos de cuatro horas", () => {
  const a = actividad(
    mensajesDe([
      /* 13/01/2026 es martes: índice 1 con la semana empezando en lunes. */
      ["13/01/26 09:30", "Ana", "uno"],
      ["13/01/26 10:00", "Beto", "dos"],
      ["13/01/26 11:00", "Ana", "tres"],
      ["13/01/26 23:00", "Beto", "cuatro"],
      ["18/01/26 02:00", "Ana", "cinco"],
    ])
  );

  it("es de 7 por 6", () => {
    expect(a.mapaPorCubos).toHaveLength(7);
    expect(a.mapaPorCubos[0]).toHaveLength(6);
  });

  it("mete cada hora en su cubo", () => {
    /* 9, 10 y 11 caen en el cubo 2 (de 8 a 12). */
    expect(a.mapaPorCubos[1][2].mensajes).toBe(3);
    /* 23:00 cae en el cubo 5 (de 20 a 24). */
    expect(a.mapaPorCubos[1][5].mensajes).toBe(1);
    /* El domingo a las 02:00 cae en el cubo 0 del día 6. */
    expect(a.mapaPorCubos[6][0].mensajes).toBe(1);
  });

  it("los cubos suman lo mismo que las 24 horas", () => {
    const porCubos = a.mapaPorCubos.flat().reduce((n, c) => n + c.mensajes, 0);
    const porHoras = a.mapaSemanal.flat().reduce((n, c) => n + c.mensajes, 0);
    expect(porCubos).toBe(porHoras);
    expect(porCubos).toBe(a.total.mensajes);
  });

  it("señala la celda con más actividad", () => {
    expect(a.puntaSemanal).toEqual({ dia: 1, cubo: 2 });
  });

  it("sin mensajes no hay punta", () => {
    expect(actividad([]).puntaSemanal).toBeNull();
  });
});

describe("meses a medias", () => {
  const deEnero12ASeptiembre15 = {
    desde: new Date(2026, 0, 12, 9, 0),
    hasta: new Date(2026, 8, 15, 20, 0),
  };
  const mesesSeguidos = (desde: number, hasta: number, valor = 100) => {
    const lista = [];
    for (let m = desde; m <= hasta; m++) {
      lista.push({
        clave: `2026-${String(m).padStart(2, "0")}`,
        anio: 2026,
        mes: m,
        mensajes: valor,
        palabras: valor * 10,
        notasDeVoz: 0,
      });
    }
    return lista;
  };

  it("marca el primero y el último, y deja enteros los de en medio", () => {
    const t = tendencias(mesesSeguidos(1, 9), "mensajes", deEnero12ASeptiembre15);
    expect(t.serie[0].parcial).toBe(true);
    expect(t.serie[0].diasCubiertos).toBe(20); /* del 12 al 31 de enero */
    expect(t.serie[8].parcial).toBe(true);
    expect(t.serie[8].diasCubiertos).toBe(15);
    expect(t.serie.slice(1, 8).every((p) => !p.parcial)).toBe(true);
  });

  it("un mes que empieza el día 1 y acaba el último no está a medias", () => {
    const t = tendencias(mesesSeguidos(1, 2), "mensajes", {
      desde: new Date(2026, 0, 1, 0, 0),
      hasta: new Date(2026, 1, 28, 23, 59),
    });
    expect(t.serie.every((p) => !p.parcial)).toBe(true);
  });

  it("sin fechas de los extremos no se marca nada", () => {
    const t = tendencias(mesesSeguidos(1, 3));
    expect(t.serie.every((p) => !p.parcial)).toBe(true);
  });

  it("un último mes a medias NO se cuenta como una caída", () => {
    /* Seis meses iguales y un séptimo a medias con la mitad de mensajes:
       nadie ha escrito menos, solo hay medio mes menos de archivo. */
    const meses = [...mesesSeguidos(1, 6, 100), ...mesesSeguidos(7, 7, 50)];
    const t = tendencias(meses, "mensajes", {
      desde: new Date(2026, 0, 1, 0, 0),
      hasta: new Date(2026, 6, 15, 12, 0),
    });
    expect(t.serie[6].parcial).toBe(true);
    expect(t.comparacion!.direccion).toBe("parecido");
  });

  it("y una caída de verdad sí se ve", () => {
    const meses = [...mesesSeguidos(1, 3, 100), ...mesesSeguidos(4, 6, 20)];
    const t = tendencias(meses, "mensajes", {
      desde: new Date(2026, 0, 1, 0, 0),
      hasta: new Date(2026, 5, 30, 23, 0),
    });
    expect(t.comparacion!.direccion).toBe("menos");
  });
});

describe("respuestas en cinco minutos o menos", () => {
  const r = tiempoDeRespuesta(
    turnosDe(
      cronologia([
        [0, "Ana", "a"],
        [2, "Beto", "en dos minutos"],
        [10, "Ana", "b"],
        [15, "Beto", "en cinco justos"],
        [20, "Ana", "c"],
        [50, "Beto", "en media hora"],
      ])
    ),
    8
  );
  const beto = r.porAutor.find((a) => a.autor === "Beto")!;

  it("cuenta las que caen dentro, incluidos los cinco justos", () => {
    expect(beto.bajoCincoMinutos).toBe(2);
  });

  it("da el porcentaje", () => {
    expect(beto.porcentajeBajoCincoMinutos).toBe(66.7);
  });

  it("separa a quien está pendiente de quien no, con la misma mediana", () => {
    /* Dos personas con mediana parecida: una contesta al vuelo la mitad de
       las veces, la otra siempre tarda un rato medio. */
    const aVeces = tiempoDeRespuesta(
      turnosDe(
        cronologia([
          [0, "Ana", "a"], [1, "Beto", "x"],
          [10, "Ana", "b"], [11, "Beto", "x"],
          [20, "Ana", "c"], [50, "Beto", "x"],
          [60, "Ana", "d"], [90, "Beto", "x"],
        ])
      ),
      8
    ).porAutor.find((a) => a.autor === "Beto")!;

    const siempreIgual = tiempoDeRespuesta(
      turnosDe(
        cronologia([
          [0, "Ana", "a"], [15, "Beto", "x"],
          [25, "Ana", "b"], [40, "Beto", "x"],
          [50, "Ana", "c"], [65, "Beto", "x"],
          [75, "Ana", "d"], [90, "Beto", "x"],
        ])
      ),
      8
    ).porAutor.find((a) => a.autor === "Beto")!;

    expect(aVeces.porcentajeBajoCincoMinutos).toBe(50);
    expect(siempreIgual.porcentajeBajoCincoMinutos).toBe(0);
  });

  it("sin respuestas, cero y no una división por cero", () => {
    expect(tiempoDeRespuesta([], 4).porAutor).toEqual([]);
  });
});
