import { FC, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import i18n, { t } from "i18next";

import { StorageContext } from "../../context/StorageContext";
import { pedirAnalisis } from "../../lib/analisis/pedirAnalisis";
import { VERSION_ANALISIS, type Analisis } from "../../lib/analisis/analizar";
import { analisisVigente, type AnalisisGuardado } from "../../lib/analisis/piezaAnalisis";
import { UMBRAL_POR_DEFECTO, type UmbralHoras } from "../../lib/analisis/iniciaMas";
import type { Medida } from "../../lib/analisis/tendencias";
import { MIN_MENSAJES } from "../../lib/analisis/umbrales";
import { conNombre, fechaCorta, numero } from "../../lib/analisis/formatear";
import { ControlSegmentado } from "../ui/ControlSegmentado";
import {
  Aviso,
  DIAS_LARGO,
  Detalle,
  EnNumeros,
  FRANJAS,
  Reparto,
  Tarjeta,
  Titular,
  enTexto,
} from "./piezas";
import { PreguntaFecha } from "./PreguntaFecha";
import { Resumen } from "./Resumen";
import { Dinamica } from "./Dinamica";
import { Palabras } from "./Palabras";
import { TablaGrupo } from "./TablaGrupo";
import { Ajustes } from "./Ajustes";

/**
 * El análisis del chat abierto.
 *
 * TODO PASA DENTRO DEL NAVEGADOR
 * ------------------------------
 * Las cuentas salen de los mensajes que ya están descifrados en memoria, en
 * un Worker, que es otro hilo del mismo navegador. El resultado se guarda
 * cifrado con la misma clave que el chat, como una pieza más del backup. En
 * todo esto no hay ni una petición a ningún servicio: ni IA, ni analítica,
 * ni nada que mandar.
 *
 * EL ORDEN DE LAS COSAS
 * ---------------------
 * 1. Se mira si hay un análisis guardado que sirva para estos ajustes.
 * 2. Si lo hay, se enseña al instante.
 * 3. Si no, se calcula y se guarda para la próxima.
 *
 * Cambiar un ajuste vuelve a empezar: no es un filtro sobre lo calculado, es
 * otra pregunta.
 */

type Vista = "resumen" | "dinamica" | "palabras" | "ajustes";

export const PanelAnalisis: FC<{
  /** Las filas del chat ya descifrado: `[fecha, autor, texto]`. */
  filas: string[][];
  /** Handle del backup abierto, para la caché cifrada. */
  handle?: string | null;
  /** Quién es «tú», si la pantalla lo ha deducido del título. */
  yoPorDefecto?: string;
  /** Saltar a un mensaje del chat. */
  onIrAlMensaje?: (indice: number) => void;
}> = ({ filas, handle, yoPorDefecto, onIrAlMensaje }) => {
  const idioma = i18n.language || "es";
  const { leerAnalisis, escribirAnalisis, bovedaAbierta } = useContext(StorageContext);

  const [vista, setVista] = useState<Vista>("resumen");
  const [umbralHoras, setUmbralHoras] = useState<UmbralHoras>(UMBRAL_POR_DEFECTO);
  const [medida, setMedida] = useState<Medida>("mensajes");
  const [yo, setYo] = useState<string | undefined>(yoPorDefecto);
  const [analisis, setAnalisis] = useState<Analisis | null>(null);
  const [calculando, setCalculando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [marcadas, setMarcadas] = useState<string[]>([]);
  /* El formato que el usuario confirmó, si tuvo que confirmarlo. */
  const [diaPrimero, setDiaPrimero] = useState<boolean | undefined>(undefined);

  /* Lo elegido a mano manda sobre lo deducido del título, pero solo cuando
     se ha elegido: si no, cambiar de chat no arrastraría el nombre viejo. */
  const yoElegido = useRef(false);

  const ajustes = useMemo(
    () => ({ umbralHoras, medida, idioma }),
    [umbralHoras, medida, idioma]
  );

  useEffect(() => {
    if (!yoElegido.current) setYo(yoPorDefecto);
  }, [yoPorDefecto]);

  useEffect(() => {
    let vigente = true;
    const abortar = new AbortController();

    const trabajar = async () => {
      setCalculando(true);
      setError(null);

      /* 1. ¿Hay algo guardado que sirva? */
      let guardado: AnalisisGuardado | null = null;
      if (handle && leerAnalisis) {
        try {
          guardado = await leerAnalisis(handle);
        } catch {
          guardado = null;
        }
      }
      if (!vigente) return;

      if (guardado?.diaPrimero !== undefined) setDiaPrimero(guardado.diaPrimero);

      if (guardado && analisisVigente(guardado, ajustes)) {
        setAnalisis(guardado.analisis);
        setMarcadas(guardado.senales?.map((s) => s.metrica) ?? []);
        if (!yoElegido.current && guardado.yo) setYo(guardado.yo);
        setCalculando(false);
        return;
      }

      /* 2. No sirve: se calcula. */
      try {
        const { analisis: nuevo } = await pedirAnalisis(
          filas,
          {
            ...ajustes,
            /* Lo confirmado a mano manda; si no, el idioma del lector como
               último recurso. */
            diaPrimeroPorDefecto:
              (guardado?.diaPrimero ?? diaPrimero) ?? !idioma.startsWith("en"),
          },
          abortar.signal
        );
        if (!vigente) return;
        setAnalisis(nuevo);
        setMarcadas(guardado?.senales?.map((s) => s.metrica) ?? []);

        /* 3. Se guarda para la próxima. Si falla, no pasa nada: el análisis
           ya está en pantalla y la próxima vez se recalcula. */
        if (handle && escribirAnalisis) {
          escribirAnalisis(handle, {
            v: VERSION_ANALISIS,
            analisis: nuevo,
            yo: yoElegido.current ? yo : guardado?.yo ?? yo,
            senales: guardado?.senales ?? [],
            cuando: Date.now(),
          }).catch(() => {
            /* Guardar es una comodidad, no parte del resultado. */
          });
        }
      } catch (e: any) {
        if (!vigente || e?.name === "AbortError") return;
        setError(e?.message || "fallo al analizar");
      } finally {
        if (vigente) setCalculando(false);
      }
    };

    trabajar();
    return () => {
      vigente = false;
      abortar.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filas, handle, ajustes, diaPrimero]);

  /** Guarda el cambio de ajuste manual dentro de la pieza cifrada. */
  const guardarEleccion = useCallback(
    (cambios: Partial<AnalisisGuardado>) => {
      if (!handle || !escribirAnalisis || !analisis) return;
      escribirAnalisis(handle, {
        v: VERSION_ANALISIS,
        analisis,
        yo,
        senales: marcadas.map((metrica) => ({ metrica, cuando: Date.now() })),
        cuando: Date.now(),
        ...cambios,
      }).catch(() => {});
    },
    [handle, escribirAnalisis, analisis, yo, marcadas]
  );

  /** El formato que el usuario dice que usa su teléfono. */
  const confirmarFecha = (valor: boolean) => {
    setDiaPrimero(valor);
    guardarEleccion({ diaPrimero: valor });
  };

  const elegirYo = (autor: string | undefined) => {
    yoElegido.current = true;
    setYo(autor);
    guardarEleccion({ yo: autor });
  };

  /**
   * «Esto no cuadra»: se anota la métrica y cuándo, y nada más.
   *
   * Va dentro de la misma pieza cifrada que el resto, por lo mismo que la
   * elección de «quién eres tú»: es una nota sobre esta conversación y no
   * tiene por qué salir de la bóveda. Mandarla a un servidor obligaría a
   * crear una colección, escribir reglas y desplegarlas, y a que algo de
   * este panel saliera del dispositivo por primera vez, que es justo lo que
   * la función promete que no pasa.
   */
  const marcarNoCuadra = (metrica: string) => {
    if (marcadas.includes(metrica)) return;
    const nuevas = [...marcadas, metrica];
    setMarcadas(nuevas);
    guardarEleccion({ senales: nuevas.map((m) => ({ metrica: m, cuando: Date.now() })) });
  };

  /* --- Estados que no son el análisis --- */

  if (!bovedaAbierta) {
    return (
      <div className="br-an">
        <Tarjeta titulo={enTexto(t("Análisis"))}>
          <Titular>{t("Abre la bóveda para analizar este chat")}</Titular>
          <Detalle>
            {t(
              "Las cuentas se hacen sobre los mensajes descifrados, en tu navegador. Sin la clave de cifrado no hay nada que contar."
            )}
          </Detalle>
        </Tarjeta>
      </div>
    );
  }

  if (error) {
    return (
      <div className="br-an">
        <Tarjeta titulo={enTexto(t("Análisis"))}>
          <Titular>{t("No se pudo analizar este chat")}</Titular>
          <Detalle>{error}</Detalle>
        </Tarjeta>
      </div>
    );
  }

  if (!analisis) {
    /* Esperar sin saber cuánto es lo que hace que una pantalla parezca rota.
       Las barras muertas dicen «esto va a tener esta forma» y quitan la duda
       de si ha pasado algo. */
    return (
      <div className="br-an">
        <div className="br-an-numeros br-an-esqueleto">
          <span className="br-an-numeros-label">{t("En números")}</span>
          <span className="br-an-hueso" style={{ width: "70%", height: 24 }} />
        </div>
        {[0, 1, 2].map((i) => (
          <Tarjeta key={i}>
            <span className="br-an-hueso" style={{ width: 120, height: 11 }} />
            <span className="br-an-hueso" style={{ width: "55%", height: 22 }} />
            <span className="br-an-hueso" style={{ width: "100%", height: 8 }} />
          </Tarjeta>
        ))}
        <p className="br-an-pie">{t("Calculando en tu navegador…")}</p>
      </div>
    );
  }

  /* Si el chat no demuestra el formato y nadie lo ha confirmado, se
     pregunta. Las cifras que no dependen del día se siguen enseñando
     debajo, para que la pregunta no deje la pantalla en blanco. */
  const hayQuePreguntar = !analisis.formatoFecha.seguro && diaPrimero === undefined;

  if (!analisis.suficiente) {
    /* Esto ya no es «hay pocos datos»: es que no hay nada que contar. Un
       archivo vacío, o un chat donde solo ha escrito una persona. */
    return (
      <div className="br-an">
        <Tarjeta titulo={enTexto(t("Análisis"))}>
          <Titular>{t("Aquí no hay conversación que contar")}</Titular>
          <Detalle>
            {analisis.autores.length < 2
              ? t("Solo hay mensajes de una persona, así que no hay a quién comparar con quién.")
              : t("El archivo no tiene mensajes con fecha que se puedan contar.")}
          </Detalle>
        </Tarjeta>
      </div>
    );
  }

  if (hayQuePreguntar) {
    return (
      <PreguntaFecha
        sugerido={analisis.formatoFecha.diaPrimero}
        onConfirmar={confirmarFecha}
      />
    );
  }

  const esGrupo = analisis.grupo.esGrupo;

  /**
   * La frase del bloque oscuro, compuesta de conteos.
   *
   * No hay nada generado aquí: son cifras metidas en una frase. Se dice
   * «sobre todo» y una franja ancha porque es lo que el dato aguanta, y si
   * no hay una franja que destaque no se dice nada de cuándo, en vez de
   * señalar la que ganó por tres mensajes.
   */
  const meses = (() => {
    if (!analisis.desde || !analisis.hasta) return 0;
    const a = new Date(analisis.desde);
    const b = new Date(analisis.hasta);
    return Math.max(1, (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()) + 1);
  })();

  const punta = analisis.actividad.puntaSemanal;
  const celdas = analisis.actividad.mapaPorCubos.flat().map((c) => c.mensajes);
  const mediaCelda = celdas.reduce((n, x) => n + x, 0) / Math.max(1, celdas.length);
  /* «Destaca» es, al menos, el doble de la celda media. Por debajo de eso
     hay un máximo pero no un patrón, y nombrarlo sería inventar. */
  const hayPatron = !!punta && celdas[punta.dia * 6 + punta.cubo] >= mediaCelda * 2;
  /* En un grupo, «Resumen» YA es la tabla: una pestaña «Grupo» aparte
     enseñaría exactamente lo mismo y haría dudar de si son dos cosas. */
  const vistas: Array<{ valor: Vista; etiqueta: string }> = [
    { valor: "resumen", etiqueta: enTexto(esGrupo ? t("Quién habla") : t("Resumen")) },
    { valor: "dinamica", etiqueta: enTexto(t("Dinámica")) },
    { valor: "palabras", etiqueta: enTexto(t("Palabras")) },
    { valor: "ajustes", etiqueta: enTexto(t("Ajustes")) },
  ];

  const vistaActual = vistas.some((v) => v.valor === vista) ? vista : "resumen";

  return (
    <div className="br-an">
      {/* De cuándo a cuándo, arriba del todo: sin esto, cualquier cifra flota
          y nadie sabe si habla de este año o de siete. */}
      <div className="br-an-rango">
        {analisis.desde && analisis.hasta && (
          <span>
            {t("Del {{desde}} al {{hasta}} · {{n}} mensajes", {
              desde: fechaCorta(new Date(analisis.desde), idioma),
              hasta: fechaCorta(new Date(analisis.hasta), idioma),
              n: numero(analisis.mensajesContables, idioma),
            })}
          </span>
        )}
        {calculando && <span>{t("Calculando…")}</span>}
      </div>

      {/* Sin saber quién eres, todo se lee en tercera persona y la mitad
             de las frases pierden sentido. */}
      {!yo && analisis.autores.length === 2 && (
        <Aviso>
          {t("¿Cuál de los dos eres tú? Elígelo en Ajustes y las tarjetas te nombrarán.")}{" "}
          <button type="button" className="br-an-enlace" onClick={() => setVista("ajustes")}>
            {t("Ir a Ajustes")}
          </button>
        </Aviso>
      )}

      {/* Lo que queda FUERA de los conteos, dicho antes de enseñar cifras. */}
      {(analisis.eliminados > 0 || analisis.sinFecha > 0) && (
        <Detalle>
          {[
            analisis.eliminados > 0
              ? t("{{n}} mensajes eliminados, que no cuentan como de nadie.", {
                  n: numero(analisis.eliminados, idioma),
                })
              : "",
            analisis.sinFecha > 0
              ? t("{{n}} con una fecha que no se entendió.", {
                  n: numero(analisis.sinFecha, idioma),
                })
              : "",
          ]
            .filter(Boolean)
            .join(" ")}
        </Detalle>
      )}

      <ControlSegmentado
        completo
        valor={vistaActual}
        onCambio={(v) => setVista(v as Vista)}
        opciones={vistas}
      />

      {vistaActual === "resumen" && (
        <EnNumeros>
          {t("{{mensajes}} en {{tiempo}}.", {
            mensajes: conNombre(
              analisis.mensajesContables,
              "{{n}} mensaje",
              "{{n}} mensajes",
              t,
              idioma
            ),
            tiempo: conNombre(meses, "{{n}} mes", "{{n}} meses", t, idioma),
          })}
          {hayPatron && punta
            ? " " +
              t("Habláis sobre todo los {{dia}} {{franja}}.", {
                dia: t(DIAS_LARGO[punta.dia]),
                franja: t(FRANJAS[punta.cubo]),
              })
            : ""}
        </EnNumeros>
      )}

      {vistaActual === "resumen" &&
        (esGrupo ? (
          <TablaGrupo
            analisis={analisis}
            yo={yo}
            marcadas={marcadas}
            onNoCuadra={marcarNoCuadra}
          />
        ) : (
          <Resumen
            analisis={analisis}
            yo={yo}
            marcadas={marcadas}
            onNoCuadra={marcarNoCuadra}
          />
        ))}

      {vistaActual === "dinamica" && (
        <Dinamica
          analisis={analisis}
          medida={medida}
          marcadas={marcadas}
          onNoCuadra={marcarNoCuadra}
        />
      )}

      {vistaActual === "palabras" && (
        <Palabras
          analisis={analisis}
          yo={yo}
          marcadas={marcadas}
          onNoCuadra={marcarNoCuadra}
          onIrAlMensaje={onIrAlMensaje}
        />
      )}

      {vistaActual === "ajustes" && (
        <Ajustes
          umbralHoras={umbralHoras}
          medida={medida}
          autores={analisis.autores}
          yo={yo}
          onUmbral={setUmbralHoras}
          onMedida={setMedida}
          onYo={elegirYo}
        />
      )}

      <p className="br-an-pie">
        {t("Calculado en tu navegador. Ni el texto del chat ni estas cifras salen de tu dispositivo.")}
      </p>
    </div>
  );
};

export default PanelAnalisis;
