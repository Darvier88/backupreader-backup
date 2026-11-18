import { FC } from "react";
import i18n, { t } from "i18next";

import type { Analisis } from "../../lib/analisis/analizar";
import { MIN_CONVERSACIONES, MIN_RESPUESTAS } from "../../lib/analisis/umbrales";
import { duracion, numero } from "../../lib/analisis/formatear";
import {
  Detalle,
  EstoNoCuadra,
  Insuficiente,
  Reparto,
  Tarjeta,
  Titular,
  enTexto,
} from "./piezas";

/**
 * Las tres preguntas que la gente se hace de verdad sobre un chat de dos:
 * quién escribe más, quién empieza y quién tarda en contestar.
 *
 * Cada tarjeta enseña el titular, el reparto y el detalle, en ese orden: el
 * titular para quien pasa de largo, el reparto para quien mira, el detalle
 * para quien no se lo cree.
 */

const ETIQUETA_DURACION = {
  segundos: "{{valor}} s",
  minutos: "{{valor}} min",
  horas: "{{valor}} h",
  dias: "{{valor}} días",
} as const;

export const Resumen: FC<{
  analisis: Analisis;
  yo?: string;
  marcadas: string[];
  onNoCuadra: (metrica: string) => void;
}> = ({ analisis, yo, marcadas, onNoCuadra }) => {
  const idioma = i18n.language || "es";
  const { volumen, inicios, respuestas } = analisis;

  const comoSeLlama = (autor: string) => (yo && autor === yo ? enTexto(t("Tú")) : autor);
  const soyYo = (autor: string) => !!yo && autor === yo;

  /* «tú escribe más» no es español: las frases en segunda persona son suyas,
     no una sustitución dentro de la frase en tercera. */
  const titular = (autor: string, propio: string, ajeno: string) =>
    soyYo(autor) ? t(propio) : t(ajeno, { quien: autor });

  const accion = (metrica: string) => (
    <EstoNoCuadra
      metrica={metrica}
      marcada={marcadas.includes(metrica)}
      onMarcar={onNoCuadra}
    />
  );

  return (
    <>
      <Tarjeta titulo={enTexto(t("Quién escribe más"))} accion={accion("volumen")}>
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
        <Detalle>
          {volumen.porAutor
            .map((a) =>
              soyYo(a.autor)
                ? t("Escribes {{n}} palabras por turno, de costumbre", {
                    n: numero(a.medianaPorTurno, idioma),
                  })
                : t("{{quien}} escribe {{n}} palabras por turno, de costumbre", {
                    quien: a.autor,
                    n: numero(a.medianaPorTurno, idioma),
                  })
            )
            .join(" · ")}
        </Detalle>
      </Tarjeta>

      <Tarjeta
        titulo={enTexto(t("Quién empieza las conversaciones"))}
        accion={accion("inicios")}
      >
        {inicios.conversaciones < MIN_CONVERSACIONES ? (
          <Insuficiente>
            {t(
              "Hay {{n}} conversaciones. A partir de {{min}} se puede decir algo sin que dependa de una semana concreta.",
              { n: inicios.conversaciones, min: MIN_CONVERSACIONES }
            )}
          </Insuficiente>
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
                .map(([autor, porcentaje]) => ({ etiqueta: comoSeLlama(autor), porcentaje }))}
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

      <Tarjeta titulo={enTexto(t("Cuánto se tarda en contestar"))} accion={accion("respuestas")}>
        {respuestas.totalRespuestas < MIN_RESPUESTAS ? (
          <Insuficiente>
            {t(
              "Hay {{n}} respuestas. A partir de {{min}} la mediana deja de moverse con cada mensaje.",
              { n: respuestas.totalRespuestas, min: MIN_RESPUESTAS }
            )}
          </Insuficiente>
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
                  <div key={a.autor} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <div
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
                    {/* La mediana sola esconde dos costumbres distintas: quien
                        contesta al instante la mitad de las veces y a las dos
                        horas la otra mitad tiene la misma mediana que quien
                        siempre tarda un rato medio. */}
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 11,
                        color: "var(--slate-500)",
                      }}
                    >
                      {t("{{rapidas}} al momento · {{medias}} en menos de una hora · {{lentas}} más tarde", {
                        rapidas: numero(a.bajoUnMinuto, idioma),
                        medias: numero(a.bajoUnaHora, idioma),
                        lentas: numero(a.masDeUnaHora, idioma),
                      })}
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
    </>
  );
};

export default Resumen;
