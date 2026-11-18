import { FC, useMemo } from "react";
import i18n, { t } from "i18next";

import { normalizar, contables } from "../../lib/analisis/normalizar";
import { agruparEnTurnos } from "../../lib/analisis/turnos";
import { escribeMas } from "../../lib/analisis/escribeMas";
import { iniciaMas, UMBRAL_POR_DEFECTO } from "../../lib/analisis/iniciaMas";
import { tiempoDeRespuesta } from "../../lib/analisis/tiempoDeRespuesta";
import { MIN_CONVERSACIONES, MIN_MENSAJES, MIN_RESPUESTAS } from "../../lib/analisis/umbrales";
import { duracion, fechaCorta, numero } from "../../lib/analisis/formatear";

/**
 * El resumen del análisis: tres tarjetas y nada más.
 *
 * TODO SE CALCULA AQUÍ, EN EL NAVEGADOR
 * -------------------------------------
 * Sobre los mensajes que ya están descifrados en memoria. No sale ni una
 * palabra del chat del dispositivo: no hay petición, no hay IA, no hay nada
 * que enviar. Por eso el cálculo va en un `useMemo` y no en un efecto con
 * `fetch`.
 *
 * (En el paso 5 esto se mueve a un Web Worker para no bloquear la pestaña en
 * chats grandes. La cuenta es la misma; cambia dónde se hace.)
 *
 * EL TONO
 * -------
 * Las tarjetas dicen quién hace más de algo, sin adjetivos y con el reparto
 * delante. Cuando la diferencia cabe en el margen, dicen «parecido», que es
 * la verdad y además evita convertir el ruido en un reproche. Nada aquí dice
 * si una conversación va bien o mal.
 */

const enTexto = (traducido: unknown): string =>
  (traducido as string | null | undefined) ?? "";

/* Las claves de i18n son la frase en español, así que la unidad se escribe
   entera y no como «duracion_minutos», que en español saldría tal cual. */
const ETIQUETA_DURACION = {
  segundos: "{{valor}} s",
  minutos: "{{valor}} min",
  horas: "{{valor}} h",
  dias: "{{valor}} días",
} as const;

/* ---------- piezas ---------- */

const Tarjeta: FC<{ titulo: string; children: React.ReactNode }> = ({ titulo, children }) => (
  <section
    style={{
      background: "var(--surface-raised)",
      border: "1px solid var(--border)",
      borderRadius: 14,
      padding: "18px 20px 20px",
      boxShadow: "var(--shadow-xs)",
      display: "flex",
      flexDirection: "column",
      gap: 14,
      minWidth: 0,
    }}
  >
    <h3
      style={{
        margin: 0,
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        color: "var(--slate-500)",
        fontWeight: 500,
      }}
    >
      {titulo}
    </h3>
    {children}
  </section>
);

/** La frase grande de la tarjeta. */
const Titular: FC<{ children: React.ReactNode }> = ({ children }) => (
  <p
    style={{
      margin: 0,
      fontFamily: "var(--font-serif)",
      fontSize: 22,
      lineHeight: 1.25,
      letterSpacing: "-0.01em",
      color: "var(--ink-900)",
    }}
  >
    {children}
  </p>
);

/** El detalle de debajo, en gris. */
const Detalle: FC<{ children: React.ReactNode }> = ({ children }) => (
  <p
    style={{
      margin: 0,
      fontFamily: "var(--font-sans)",
      fontSize: 13,
      lineHeight: 1.5,
      color: "var(--slate-700)",
    }}
  >
    {children}
  </p>
);

/**
 * La barra del reparto.
 *
 * Es lo que deja ver que 52/48 no es lo mismo que 80/20 sin leer un número.
 */
const Reparto: FC<{ partes: Array<{ etiqueta: string; porcentaje: number }> }> = ({ partes }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
    <div
      style={{
        display: "flex",
        height: 8,
        borderRadius: 999,
        overflow: "hidden",
        background: "var(--paper-100)",
      }}
    >
      {partes.map((p, i) => (
        <div
          key={p.etiqueta}
          style={{
            width: `${p.porcentaje}%`,
            background: i === 0 ? "var(--ink-900)" : "var(--slate-300, #c9ccd1)",
          }}
        />
      ))}
    </div>
    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 16px" }}>
      {partes.map((p, i) => (
        <span
          key={p.etiqueta}
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11.5,
            color: i === 0 ? "var(--ink-900)" : "var(--slate-500)",
          }}
        >
          {p.etiqueta} · {p.porcentaje}%
        </span>
      ))}
    </div>
  </div>
);

/** Lo que se enseña cuando aún no hay conversación suficiente. */
const Insuficiente: FC<{ texto: string }> = ({ texto }) => (
  <Detalle>{texto}</Detalle>
);

/* ---------- el panel ---------- */

export const PanelAnalisis: FC<{
  /** Las filas del chat ya descifrado: `[fecha, autor, texto]`. */
  filas: string[][];
  /** Quién es «tú», si se sabe. */
  yo?: string;
}> = ({ filas, yo }) => {
  const idioma = i18n.language || "es";

  const datos = useMemo(() => {
    const chat = normalizar(filas, { idioma });
    const mensajes = contables(chat);
    const turnos = agruparEnTurnos(mensajes);

    return {
      chat,
      mensajes,
      volumen: escribeMas(mensajes, turnos),
      inicios: iniciaMas(mensajes, UMBRAL_POR_DEFECTO),
      respuestas: tiempoDeRespuesta(turnos, UMBRAL_POR_DEFECTO),
    };
  }, [filas, idioma]);

  const { chat, mensajes, volumen, inicios, respuestas } = datos;

  /** El nombre tal como se enseña: «Tú» para quien está mirando. */
  const comoSeLlama = (autor: string) => (yo && autor === yo ? enTexto(t("Tú")) : autor);
  const soyYo = (autor: string) => !!yo && autor === yo;

  /**
   * El titular, con el verbo en la persona que toca.
   *
   * Meter «tú» en «{{quien}} escribe más» da «tú escribe más», que no es
   * español. Las frases en segunda persona son suyas, no una sustitución.
   */
  const titular = (autor: string, propio: string, ajeno: string) =>
    soyYo(autor) ? t(propio) : t(ajeno, { quien: autor });

  if (mensajes.length < MIN_MENSAJES) {
    return (
      <div style={{ padding: "8px 0 24px" }}>
        <Tarjeta titulo={enTexto(t("Análisis"))}>
          <Titular>{t("Aún no hay bastante conversación")}</Titular>
          <Detalle>
            {t(
              "Este chat tiene {{n}} mensajes. A partir de {{min}} las cifras empiezan a decir algo de la conversación y no de una tarde suelta.",
              { n: numero(mensajes.length, idioma), min: MIN_MENSAJES }
            )}
          </Detalle>
        </Tarjeta>
      </div>
    );
  }

  return (
    <div style={{ padding: "8px 0 24px", display: "flex", flexDirection: "column", gap: 14 }}>
      {/* De cuándo a cuándo, arriba del todo: sin esto, cualquier cifra flota. */}
      {chat.desde && chat.hasta && (
        <p
          style={{
            margin: 0,
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--slate-500)",
          }}
        >
          {t("Del {{desde}} al {{hasta}} · {{n}} mensajes", {
            desde: fechaCorta(chat.desde, idioma),
            hasta: fechaCorta(chat.hasta, idioma),
            n: numero(mensajes.length, idioma),
          })}
        </p>
      )}

      {/* 1. Quién escribe más */}
      <Tarjeta titulo={enTexto(t("Quién escribe más"))}>
        <Titular>
          {volumen.masPalabras.parecido
            ? t("Escribís parecido")
            : titular(volumen.masPalabras.mayor || "", "Escribes más", "{{quien}} escribe más")}
        </Titular>
        <Reparto
          partes={volumen.porAutor.map((a) => ({
            etiqueta: comoSeLlama(a.autor),
            porcentaje: a.porcentajePalabras,
          }))}
        />
        <Detalle>
          {volumen.porAutor
            .map((a) =>
              t("{{quien}}: {{mensajes}} mensajes, {{palabras}} palabras", {
                quien: comoSeLlama(a.autor),
                mensajes: numero(a.mensajes, idioma),
                palabras: numero(a.palabras, idioma),
              })
            )
            .join(" · ")}
        </Detalle>
      </Tarjeta>

      {/* 2. Quién empieza */}
      <Tarjeta titulo={enTexto(t("Quién empieza las conversaciones"))}>
        {inicios.conversaciones < MIN_CONVERSACIONES ? (
          <Insuficiente
            texto={enTexto(
              t(
                "Hay {{n}} conversaciones. A partir de {{min}} se puede decir algo sin que dependa de una semana concreta.",
                { n: inicios.conversaciones, min: MIN_CONVERSACIONES }
              )
            )}
          />
        ) : (
          <>
            <Titular>
              {inicios.masInicios.parecido
                ? t("Empezáis por igual")
                : titular(
                    inicios.masInicios.mayor || "",
                    "Escribes primero más veces",
                    "{{quien}} escribe primero más veces"
                  )}
            </Titular>
            <Reparto
              partes={Object.entries(inicios.porcentajes)
                .sort((a, b) => b[1] - a[1])
                .map(([autor, porcentaje]) => ({
                  etiqueta: comoSeLlama(autor),
                  porcentaje,
                }))}
            />
            <Detalle>
              {t(
                "{{n}} conversaciones, contando como nueva la que llega tras {{horas}} h de silencio.",
                { n: numero(inicios.conversaciones, idioma), horas: inicios.umbralHoras }
              )}
            </Detalle>
          </>
        )}
      </Tarjeta>

      {/* 3. Cuánto se tarda en contestar */}
      <Tarjeta titulo={enTexto(t("Cuánto se tarda en contestar"))}>
        {respuestas.totalRespuestas < MIN_RESPUESTAS ? (
          <Insuficiente
            texto={enTexto(
              t(
                "Hay {{n}} respuestas. A partir de {{min}} la mediana deja de moverse con cada mensaje.",
                { n: respuestas.totalRespuestas, min: MIN_RESPUESTAS }
              )
            )}
          />
        ) : (
          <>
            <Titular>
              {respuestas.tardaMas.parecido
                ? t("Contestáis en un tiempo parecido")
                : titular(
                    respuestas.tardaMas.mayor || "",
                    "Tardas más en contestar",
                    "{{quien}} tarda más en contestar"
                  )}
            </Titular>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {respuestas.porAutor.map((a) => {
                const d = duracion(a.medianaMs);
                return (
                  <div
                    key={a.autor}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      alignItems: "baseline",
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "var(--font-sans)",
                        fontSize: 13.5,
                        color: "var(--ink-900)",
                      }}
                    >
                      {comoSeLlama(a.autor)}
                    </span>
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 13,
                        color: "var(--slate-700)",
                      }}
                    >
                      {t(ETIQUETA_DURACION[d.unidad], { valor: numero(d.valor, idioma) })}
                    </span>
                  </div>
                );
              })}
            </div>
            <Detalle>
              {t("Mediana de {{n}} respuestas, medida desde que el otro deja de escribir.", {
                n: numero(respuestas.totalRespuestas, idioma),
              })}
            </Detalle>
          </>
        )}
      </Tarjeta>

      {/* Dónde se calcula esto. Es la pregunta que se hace cualquiera al ver
          un análisis de sus conversaciones, y merece estar a la vista. */}
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
