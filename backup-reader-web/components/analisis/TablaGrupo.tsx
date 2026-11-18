import { FC, useState } from "react";
import i18n, { t } from "i18next";

import type { Analisis } from "../../lib/analisis/analizar";
import type { FilaDeGrupo } from "../../lib/analisis/grupos";
import { fechaCorta, numero } from "../../lib/analisis/formatear";
import { Detalle, EstoNoCuadra, Tarjeta, Titular, enTexto } from "./piezas";

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
  marcadas: string[];
  onNoCuadra: (metrica: string) => void;
}> = ({ analisis, yo, marcadas, onNoCuadra }) => {
  const idioma = i18n.language || "es";
  const [orden, setOrden] = useState<keyof FilaDeGrupo>("mensajes");
  const { grupo } = analisis;

  const comoSeLlama = (autor: string) => (yo && autor === yo ? enTexto(t("Tú")) : autor);

  const filas = [...grupo.filas].sort((a, b) => {
    const va = a[orden];
    const vb = b[orden];
    if (typeof va === "number" && typeof vb === "number") return vb - va;
    return String(va).localeCompare(String(vb));
  });

  return (
    <Tarjeta
      titulo={enTexto(t("Quién habla en el grupo"))}
      accion={
        <EstoNoCuadra
          metrica="grupo"
          marcada={marcadas.includes("grupo")}
          onMarcar={onNoCuadra}
        />
      }
    >
      <Titular>
        {t("{{n}} personas, {{m}} mensajes", {
          n: grupo.personas,
          m: numero(grupo.totalMensajes, idioma),
        })}
      </Titular>

      <div style={{ overflowX: "auto", margin: "0 -4px" }}>
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
