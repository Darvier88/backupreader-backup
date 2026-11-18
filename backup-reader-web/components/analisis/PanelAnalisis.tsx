import { FC, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import i18n, { t } from "i18next";

import { StorageContext } from "../../context/StorageContext";
import { pedirAnalisis } from "../../lib/analisis/pedirAnalisis";
import { VERSION_ANALISIS, type Analisis } from "../../lib/analisis/analizar";
import { analisisVigente, type AnalisisGuardado } from "../../lib/analisis/piezaAnalisis";
import { UMBRAL_POR_DEFECTO, type UmbralHoras } from "../../lib/analisis/iniciaMas";
import type { Medida } from "../../lib/analisis/tendencias";
import { MIN_MENSAJES } from "../../lib/analisis/umbrales";
import { fechaCorta, numero } from "../../lib/analisis/formatear";
import { ControlSegmentado } from "../ui/ControlSegmentado";
import { Detalle, Tarjeta, Titular, enTexto } from "./piezas";
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

type Vista = "resumen" | "dinamica" | "palabras" | "grupo" | "ajustes";

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
          { ...ajustes, diaPrimeroPorDefecto: idioma.startsWith("en") ? false : true },
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
  }, [filas, handle, ajustes]);

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
      <div style={{ padding: "8px 0 24px" }}>
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
      <div style={{ padding: "8px 0 24px" }}>
        <Tarjeta titulo={enTexto(t("Análisis"))}>
          <Titular>{t("No se pudo analizar este chat")}</Titular>
          <Detalle>{error}</Detalle>
        </Tarjeta>
      </div>
    );
  }

  if (!analisis) {
    return (
      <div style={{ padding: "8px 0 24px" }}>
        <Tarjeta titulo={enTexto(t("Análisis"))}>
          <Detalle>{t("Calculando…")}</Detalle>
        </Tarjeta>
      </div>
    );
  }

  if (!analisis.suficiente) {
    return (
      <div style={{ padding: "8px 0 24px" }}>
        <Tarjeta titulo={enTexto(t("Análisis"))}>
          <Titular>{t("Aún no hay bastante conversación")}</Titular>
          <Detalle>
            {t(
              "Este chat tiene {{n}} mensajes. A partir de {{min}} las cifras empiezan a decir algo de la conversación y no de una tarde suelta.",
              { n: numero(analisis.mensajesContables, idioma), min: MIN_MENSAJES }
            )}
          </Detalle>
        </Tarjeta>
      </div>
    );
  }

  const esGrupo = analisis.grupo.esGrupo;
  const vistas: Array<{ valor: Vista; etiqueta: string }> = [
    { valor: "resumen", etiqueta: enTexto(t("Resumen")) },
    { valor: "dinamica", etiqueta: enTexto(t("Dinámica")) },
    { valor: "palabras", etiqueta: enTexto(t("Palabras")) },
    ...(esGrupo ? [{ valor: "grupo" as Vista, etiqueta: enTexto(t("Grupo")) }] : []),
    { valor: "ajustes", etiqueta: enTexto(t("Ajustes")) },
  ];

  const vistaActual = vistas.some((v) => v.valor === vista) ? vista : "resumen";

  return (
    <div style={{ padding: "8px 0 24px", display: "flex", flexDirection: "column", gap: 14 }}>
      {/* De cuándo a cuándo, arriba del todo: sin esto, cualquier cifra flota
          y nadie sabe si habla de este año o de siete. */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "4px 12px",
          alignItems: "baseline",
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--slate-500)",
        }}
      >
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

      {vistaActual === "grupo" && (
        <TablaGrupo analisis={analisis} yo={yo} marcadas={marcadas} onNoCuadra={marcarNoCuadra} />
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

      <p
        style={{
          margin: "2px 0 0",
          fontFamily: "var(--font-sans)",
          fontSize: 12,
          lineHeight: 1.5,
          color: "var(--slate-500)",
        }}
      >
        {t("Calculado en tu navegador. Ni el texto del chat ni estas cifras salen de tu dispositivo.")}
      </p>
    </div>
  );
};

export default PanelAnalisis;
