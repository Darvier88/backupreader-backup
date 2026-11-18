import { FC } from "react";
import i18n, { t } from "i18next";

import type { Analisis } from "../../lib/analisis/analizar";
import type { Medida } from "../../lib/analisis/tendencias";
import { numero } from "../../lib/analisis/formatear";
import { Barra, Detalle, EstoNoCuadra, Tarjeta, Titular, enTexto } from "./piezas";

/**
 * Cuándo se habla: horas del día, días de la semana y meses.
 *
 * TODO SE DIBUJA CON DIVS
 * -----------------------
 * Ni librería de gráficas ni canvas. Son tres formas sencillas —barras y una
 * rejilla— y meter una dependencia de gráficas por esto añadiría cientos de
 * kilobytes a una pantalla que la mayoría de la gente abre una vez. Además,
 * con divs la rejilla es texto de verdad: se puede leer con un lector de
 * pantalla y se puede seleccionar.
 */

const DIAS = ["L", "M", "X", "J", "V", "S", "D"];
const DIAS_LARGO = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];

const MESES = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

/** El nombre del mes en el idioma de quien mira. */
function nombreDeMes(anio: number, mes: number, idioma: string): string {
  try {
    return new Intl.DateTimeFormat(idioma, { month: "short", year: "2-digit" }).format(
      new Date(anio, mes - 1, 1)
    );
  } catch {
    return `${MESES[mes - 1]} ${String(anio).slice(2)}`;
  }
}

export const Dinamica: FC<{
  analisis: Analisis;
  medida: Medida;
  marcadas: string[];
  onNoCuadra: (metrica: string) => void;
}> = ({ analisis, medida, marcadas, onNoCuadra }) => {
  const idioma = i18n.language || "es";
  const { actividad, tendencias } = analisis;

  const valor = (c: { mensajes: number; palabras: number; notasDeVoz: number }) => c[medida];
  const maxHora = Math.max(1, ...actividad.porHora.map(valor));
  const maxDia = Math.max(1, ...actividad.porDiaDeLaSemana.map(valor));
  const maxMes = Math.max(1, ...tendencias.serie.map((p) => p.valor));

  const horaPunta = actividad.porHora.reduce(
    (mejor, c, i) => (valor(c) > valor(actividad.porHora[mejor]) ? i : mejor),
    0
  );
  const diaPunta = actividad.porDiaDeLaSemana.reduce(
    (mejor, c, i) => (valor(c) > valor(actividad.porDiaDeLaSemana[mejor]) ? i : mejor),
    0
  );

  const accion = (metrica: string) => (
    <EstoNoCuadra metrica={metrica} marcada={marcadas.includes(metrica)} onMarcar={onNoCuadra} />
  );

  return (
    <>
      <Tarjeta titulo={enTexto(t("A qué horas"))} accion={accion("horas")}>
        <Titular>
          {t("Sobre todo a las {{hora}}", { hora: `${String(horaPunta).padStart(2, "0")}:00` })}
        </Titular>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 90 }}>
          {actividad.porHora.map((c, h) => (
            <div
              key={h}
              title={`${String(h).padStart(2, "0")}:00 · ${numero(valor(c), idioma)}`}
              style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", height: "100%" }}
            >
              <div
                style={{
                  height: `${Math.max(2, (valor(c) / maxHora) * 100)}%`,
                  background: h === horaPunta ? "var(--ink-900)" : "#c2c7cc",
                  borderRadius: 3,
                }}
              />
            </div>
          ))}
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "var(--slate-500)",
          }}
        >
          <span>00</span>
          <span>06</span>
          <span>12</span>
          <span>18</span>
          <span>23</span>
        </div>
        {/* El export trae la hora del teléfono que lo generó, sin huso. Decirlo
            evita que alguien lea «escribes de madrugada» siendo mediodía. */}
        <Detalle>
          {t("Son las horas del teléfono que exportó el chat, no las de donde estés ahora.")}
        </Detalle>
      </Tarjeta>

      <Tarjeta titulo={enTexto(t("Qué días"))} accion={accion("dias")}>
        <Titular>{t("Sobre todo los {{dia}}", { dia: t(DIAS_LARGO[diaPunta]) })}</Titular>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {actividad.porDiaDeLaSemana.map((c, d) => (
            <div key={d} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span
                style={{
                  width: 18,
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  color: d === diaPunta ? "var(--ink-900)" : "var(--slate-500)",
                }}
              >
                {DIAS[d]}
              </span>
              <div style={{ flex: 1 }}>
                <Barra parte={valor(c)} total={maxDia} />
              </div>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  color: "var(--slate-500)",
                  minWidth: 46,
                  textAlign: "right",
                }}
              >
                {numero(valor(c), idioma)}
              </span>
            </div>
          ))}
        </div>
      </Tarjeta>

      <Tarjeta titulo={enTexto(t("Mes a mes"))} accion={accion("tendencias")}>
        {tendencias.comparacion && (
          <Titular>
            {tendencias.comparacion.direccion === "parecido"
              ? t("Los últimos meses, parecido que antes")
              : tendencias.comparacion.direccion === "mas"
              ? t("Los últimos meses, más que antes")
              : t("Los últimos meses, menos que antes")}
          </Titular>
        )}
        {/* Los meses vacíos se dibujan a cero: si se saltaran, tres meses de
            silencio desaparecerían y la línea parecería continua. */}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 90 }}>
          {tendencias.serie.map((p) => (
            <div
              key={p.clave}
              title={`${nombreDeMes(p.anio, p.mes, idioma)} · ${numero(p.valor, idioma)}`}
              style={{ flex: 1, minWidth: 4, display: "flex", flexDirection: "column", justifyContent: "flex-end", height: "100%" }}
            >
              <div
                style={{
                  height: `${Math.max(1, (p.valor / maxMes) * 100)}%`,
                  background: p.valor === 0 ? "var(--paper-100)" : "#c2c7cc",
                  borderRadius: 3,
                }}
              />
            </div>
          ))}
        </div>
        {tendencias.serie.length > 0 && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: "var(--slate-500)",
            }}
          >
            <span>{nombreDeMes(tendencias.serie[0].anio, tendencias.serie[0].mes, idioma)}</span>
            <span>
              {nombreDeMes(
                tendencias.serie[tendencias.serie.length - 1].anio,
                tendencias.serie[tendencias.serie.length - 1].mes,
                idioma
              )}
            </span>
          </div>
        )}
        {tendencias.comparacion && (
          <Detalle>
            {t(
              "Media de los últimos {{meses}} meses: {{reciente}}. Los {{meses}} anteriores: {{anterior}}.",
              {
                meses: tendencias.comparacion.meses,
                reciente: numero(tendencias.comparacion.reciente, idioma),
                anterior: numero(tendencias.comparacion.anterior, idioma),
              }
            )}
          </Detalle>
        )}
        {tendencias.masActivo && (
          <Detalle>
            {t("El mes con más actividad fue {{mes}}.", {
              mes: nombreDeMes(tendencias.masActivo.anio, tendencias.masActivo.mes, idioma),
            })}
          </Detalle>
        )}
      </Tarjeta>
    </>
  );
};

export default Dinamica;
