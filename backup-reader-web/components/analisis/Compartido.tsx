import { FC } from "react";
import i18n, { t } from "i18next";

import type { Analisis } from "../../lib/analisis/analizar";
import { numero } from "../../lib/analisis/formatear";
import { Aviso, Barra, Detalle, Tarjeta, Titular, enTexto } from "./piezas";

/**
 * Lo que se compartió: fotos, vídeos, notas de voz, PDF, enlaces.
 *
 * Va suelta y no dentro de una vista porque la primera vista no es la misma
 * en un chat de dos («Resumen») que en un grupo («Quién habla»), y esto
 * interesa igual en los dos. Metida en el resumen, en un grupo no se pintaba
 * nunca, que es donde más cosas se comparten.
 *
 * Tampoco tiene pestaña propia: son cifras del mismo tipo que las de arriba,
 * y una quinta pestaña no cabe en el panel de un grupo.
 */
export const Compartido: FC<{
  analisis: Analisis;
  /** Quién es «tú», para nombrarlo en segunda persona. */
  yo?: string;
}> = ({ analisis, yo }) => {
  const idioma = i18n.language || "es";
  const comoSeLlama = (autor: string) => (yo && autor === yo ? enTexto(t("Tú")) : autor);

  if (!analisis.media || analisis.media.total === 0) return null;

  return (
      <Tarjeta titulo={enTexto(t("Lo que se compartió"))}>
        <Titular>
          {t("{{n}} cosas compartidas", {
            n: numero(analisis.media.total, idioma),
          })}
        </Titular>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
          {analisis.media.filas.map((f) => (
            <div key={f.clase} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  gap: 10,
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: 14,
                    color: "var(--ink-900)",
                  }}
                >
                  {t(f.clase)}
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5 }}>
                  {numero(f.total, idioma)}
                </span>
              </div>
              <Barra parte={f.total} total={analisis.media.filas[0].total} alto={4} />
              {/* Quién las puso, cuando no es cosa de uno solo. */}
              {Object.keys(f.porAutor).length > 1 && (
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    color: "var(--slate-500)",
                  }}
                >
                  {Object.entries(f.porAutor)
                    .sort((a, b) => b[1] - a[1])
                    .map(([autor, n]) => `${comoSeLlama(autor)} ${numero(n, idioma)}`)
                    .join(" · ")}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Un export sin archivos cambia cómo hay que leer toda la tarjeta:
            casi todo cae en «sin identificar» y el resto sale corto, no
            porque no se compartiera nada. */}
        {analisis.media.sinArchivos ? (
          <Aviso>
            {t(
              "Este chat se exportó sin los archivos, así que la mayoría de los adjuntos no dicen de qué eran."
            )}
          </Aviso>
        ) : (
          <Detalle>
            {t(
              "Las notas de voz se distinguen de un audio compartido por el nombre del archivo; sin los archivos, no se pueden separar."
            )}
          </Detalle>
        )}
      </Tarjeta>
  );
};

export default Compartido;
