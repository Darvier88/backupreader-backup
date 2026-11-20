import { FC, useState } from "react";
import i18n, { t } from "i18next";

import type { Analisis } from "../../lib/analisis/analizar";
import type { FilaDeGrupo } from "../../lib/analisis/grupos";
import { fechaCorta, numero } from "../../lib/analisis/formatear";
import { Detalle, Tarjeta, Titular, enTexto } from "./piezas";

/**
 * La tabla del grupo.
 *
 * ORDENABLE, Y POR ESO MISMO SIN VEREDICTO
 * ----------------------------------------
 * En un grupo de catorce, «quién escribe más» no dice nada: alguien tiene
 * que ser el primero. Lo que sí sirve es poder ordenar por lo que a cada uno
 * le interese y mirarlo. Por eso aquí no hay titular que señale a nadie.
 */

type Columna = {
  clave: keyof FilaDeGrupo;
  etiqueta: string;
  /** Cómo se escribe el valor. */
  pinta: (f: FilaDeGrupo, idioma: string) => string;
  /** A la derecha si es un número. */
  numerica?: boolean;
};

const COLUMNAS: Columna[] = [
  {
    clave: "autor",
    etiqueta: "Persona",
    pinta: (f) => f.autor,
  },
  {
    clave: "mensajes",
    etiqueta: "Mensajes",
    pinta: (f, i) => `${numero(f.mensajes, i)} · ${numero(f.porcentajeMensajes, i)}%`,
    numerica: true,
  },
  {
    clave: "palabrasPorMensaje",
    etiqueta: "Palabras por mensaje",
    pinta: (f, i) => numero(f.palabrasPorMensaje, i),
    numerica: true,
  },
  {
    clave: "inicios",
    etiqueta: "Empieza",
    pinta: (f, i) => numero(f.inicios, i),
    numerica: true,
  },
  {
    clave: "media",
    etiqueta: "Media",
    pinta: (f, i) => numero(f.media, i),
    numerica: true,
  },
  {
    clave: "emojis",
    etiqueta: "Emojis",
    pinta: (f, i) => numero(f.emojis, i),
    numerica: true,
  },
  {
    clave: "ultimo",
    etiqueta: "Último mensaje",
    pinta: (f, i) => (f.ultimo ? fechaCorta(new Date(f.ultimo), i) : "—"),
    numerica: true,
  },
];

export const TablaGrupo: FC<{
  analisis: Analisis;
  yo?: string;
}> = ({ analisis, yo }) => {
  const idioma = i18n.language || "es";
  const [orden, setOrden] = useState<keyof FilaDeGrupo>("mensajes");
  const { grupo } = analisis;

  const comoSeLlama = (autor: string) => (yo && autor === yo ? enTexto(t("Tú")) : autor);

  /* Solo se nombra a alguien si la diferencia se nota: cinco puntos, el
     mismo margen que usamos para «parecido» en todo lo demás. */
  const destacado = grupo.detrasDe.find((d) => d.diferencia >= 5) ?? null;

  const filas = [...grupo.filas].sort((a, b) => {
    const va = a[orden];
    const vb = b[orden];
    if (typeof va === "number" && typeof vb === "number") return vb - va;
    return String(va).localeCompare(String(vb));
  });

  return (
    <Tarjeta
      titulo={enTexto(t("Quién habla en el grupo"))}
    >
      <Titular>
        {/* En dos trozos y no en una frase: las dos cifras pueden valer 1,
            y una sola clave obligaría a escribir las cuatro combinaciones. */}
        {(grupo.personas === 1
          ? enTexto(t("1 persona"))
          : enTexto(t("{{n}} personas", { n: grupo.personas }))) +
          ", " +
          (grupo.totalMensajes === 1
            ? enTexto(t("1 mensaje"))
            : enTexto(
                t("{{m}} mensajes", { m: numero(grupo.totalMensajes, idioma) })
              ))}
      </Titular>

      {/* La tabla no cabe en un móvil y se desliza. Sin decirlo, la columna
          cortada contra el borde se lee como el final de la tabla y las
          cuatro de la derecha no existen para quien mira. La sombra del
          borde es la señal; desaparece al llegar al final. */}
      <div className="br-an-tabla-caja">
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontFamily: "var(--font-sans)",
            fontSize: 13,
          }}
        >
          <thead>
            <tr>
              {COLUMNAS.map((c) => (
                <th
                  key={String(c.clave)}
                  onClick={() => setOrden(c.clave)}
                  /* La primera columna se queda quieta al deslizar: con los
                     nombres fuera de la vista, los números de la derecha no
                     son de nadie. */
                  className={c.clave === "autor" ? "br-an-col-fija" : undefined}
                  style={{
                    textAlign: c.numerica ? "right" : "left",
                    padding: "6px 8px",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    borderBottom: "1px solid var(--border)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 10.5,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    fontWeight: 500,
                    color: orden === c.clave ? "var(--ink-900)" : "var(--slate-500)",
                  }}
                >
                  {t(c.etiqueta)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.autor}>
                {COLUMNAS.map((c) => (
                  <td
                    key={String(c.clave)}
                    className={c.clave === "autor" ? "br-an-col-fija" : undefined}
                    style={{
                      textAlign: c.numerica ? "right" : "left",
                      padding: "8px",
                      whiteSpace: "nowrap",
                      borderBottom: "1px solid var(--border)",
                      fontFamily: c.numerica ? "var(--font-mono)" : "var(--font-sans)",
                      fontSize: c.numerica ? 12 : 13,
                      color: c.clave === "autor" ? "var(--ink-900)" : "var(--slate-700)",
                    }}
                  >
                    {c.clave === "autor" ? comoSeLlama(f.autor) : c.pinta(f, idioma)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Quién escribe detrás de ti, SIEMPRE con su parte del grupo al lado.
          La cifra sola engaña: quien manda el 31 % de los mensajes sale el
          primero detrás de ti por aritmética, no porque te conteste. */}
      {grupo.detrasDe.length > 0 && (
        <div className="br-an-detras">
          <div className="br-an-detras-cabecera">
            <span className="br-an-detras-nombre">{t("Quién escribe detrás de ti")}</span>
            <span className="br-an-detras-col">{t("Del grupo")}</span>
            <span className="br-an-detras-col">{t("Detrás de ti")}</span>
          </div>
          {grupo.detrasDe.map((d) => (
            <div key={d.autor} className="br-an-detras-fila">
              <span className="br-an-detras-nombre">{comoSeLlama(d.autor)}</span>
              <span className="br-an-detras-col">{numero(d.porcentajeGrupo, idioma)} %</span>
              <span className="br-an-detras-col br-an-detras-col--fuerte">
                {numero(d.porcentajeDetras, idioma)} %
              </span>
            </div>
          ))}
          {destacado && (
            <Detalle>
              {t("{{quien}}: {{n}} puntos más detrás de ti que en el grupo.", {
                quien: comoSeLlama(destacado.autor),
                n: numero(destacado.diferencia, idioma),
              })}
            </Detalle>
          )}
          <Detalle>
            {t(
              "Detrás de ti = el siguiente mensaje de otra persona, en menos de 10 min. El archivo no dice si es una respuesta; en un grupo suele ser quién está activo a tus horas."
            )}
          </Detalle>
        </div>
      )}

      {grupo.masCallado && (
        <Detalle>
          {t("{{quien}} no escribe desde el {{cuando}}.", {
            quien: comoSeLlama(grupo.masCallado.autor),
            cuando: fechaCorta(new Date(grupo.masCallado.ultimo), idioma),
          })}
        </Detalle>
      )}

      {/* Decir lo que NO hay evita que alguien lo busque o se lo imagine. */}
      <Detalle>
        {t(
          "No hay «quién responde a quién»: en un grupo, escribir después de alguien no es contestarle, y el export no guarda las citas."
        )}
      </Detalle>
    </Tarjeta>
  );
};

export default TablaGrupo;
