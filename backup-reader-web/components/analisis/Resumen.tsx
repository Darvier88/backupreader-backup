import { FC } from "react";
import i18n, { t } from "i18next";

import type { Analisis } from "../../lib/analisis/analizar";
import { MIN_CONVERSACIONES, MIN_RESPUESTAS } from "../../lib/analisis/umbrales";
import { conNombre, duracion, numero } from "../../lib/analisis/formatear";
import {
  Barra,
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

  /* `tardaMas` nombra al lento; para el titular hace falta el otro. La lista
     viene ordenada de mediana más baja a más alta, así que el primero es el
     que responde antes. */
  const masRapido = respuestas.porAutor[0]?.autor;

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
        {/* El titular dice QUÉ cuenta. En un chat de fotos, «escribe más»
            por mensajes y por palabras pueden señalar a personas distintas,
            y sin decirlo la cifra parece un hecho en vez de una medida. */}
        <Titular>
          {volumen.masPalabras.parecido
            ? t("Escribís parecido, en palabras")
            : titular(
                volumen.masPalabras.mayor || "",
                "Escribes más palabras",
                "{{quien}} escribe más palabras"
              )}
        </Titular>
        {/* Y si por mensajes gana el otro, se dice: es la contradicción que
            más desconfianza genera si el lector la descubre solo. */}
        {!volumen.masMensajes.parecido &&
          !volumen.masPalabras.parecido &&
          volumen.masMensajes.mayor !== volumen.masPalabras.mayor && (
            <Detalle>
              {t("Por número de mensajes gana {{quien}}: son dos formas de contar.", {
                quien: comoSeLlama(volumen.masMensajes.mayor || ""),
              })}
            </Detalle>
          )}
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
            .map((a) => {
              /* «1 palabras por turno» no es español, y con medianas bajas
                 pasa constantemente. */
              const cuantas = conNombre(
                a.medianaPorTurno,
                "{{n}} palabra",
                "{{n}} palabras",
                t,
                idioma
              );
              return soyYo(a.autor)
                ? t("Escribes {{cuantas}} por turno, de costumbre", { cuantas })
                : t("{{quien}} escribe {{cuantas}} por turno, de costumbre", {
                    quien: a.autor,
                    cuantas,
                  });
            })
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
            {/* Se nombra al que responde antes, no al que tarda. Dice lo
                mismo y no suena a reproche sobre nadie. */}
            <Titular>
              {respuestas.tardaMas.parecido
                ? t("Contestáis en un tiempo parecido")
                : titular(
                    masRapido || "",
                    "Respondes antes",
                    "{{quien}} responde antes"
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
                        siempre tarda un rato medio. El porcentaje por debajo
                        de cinco minutos es lo que separa esos dos casos. */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ flex: 1, maxWidth: 160 }}>
                        <Barra parte={a.bajoCincoMinutos} total={a.respuestas} alto={4} />
                      </div>
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 11,
                          color: "var(--slate-500)",
                        }}
                      >
                        {t("{{pct}} % contesta en 5 min o menos", {
                          pct: numero(a.porcentajeBajoCincoMinutos, idioma),
                        })}
                      </span>
                    </div>
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
