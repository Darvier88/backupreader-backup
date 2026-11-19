import { FC, useMemo } from "react";
import i18n, { t } from "i18next";

import type { Analisis } from "../../lib/analisis/analizar";
import type { Medida } from "../../lib/analisis/tendencias";
import { fechaCorta, numero } from "../../lib/analisis/formatear";
import {
  DIAS,
  DIAS_LARGO,
  Detalle,
  EstoNoCuadra,
  FRANJAS,
  HORA_INICIAL,
  Tarjeta,
  Titular,
  enTexto,
} from "./piezas";

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


/**
 * El gris de una celda del mapa.
 *
 * La escala es lineal a propósito: el doble de oscuro es el doble de
 * mensajes. Probé con la raíz cuadrada, que reparte mejor el color cuando
 * hay una franja que dispara, pero levanta tanto las celdas medias que un
 * chat repartido parece tener un patrón que no tiene. En un mapa de calor,
 * exagerar lo pequeño es exactamente la forma de mentir.
 *
 * El suelo de 0,10 existe para que una celda con un mensaje se distinga de
 * una vacía, que si no se leen igual.
 */
function tinta(valor: number, maximo: number): string {
  if (valor <= 0) return "var(--paper-100)";
  const fuerza = valor / Math.max(1, maximo);
  /* De un papel apenas teñido al azul tinta de la marca. */
  return `rgba(22, 35, 59, ${(0.1 + fuerza * 0.8).toFixed(3)})`;
}

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
  const maxCubo = Math.max(1, ...actividad.mapaPorCubos.flat().map(valor));
  const maxMes = Math.max(1, ...tendencias.serie.map((p) => p.valor));

  /* La punta que guarda `actividad` se calcula sobre mensajes. Si se está
     mirando otra medida, se vuelve a buscar sobre esa, que si no el titular
     señalaría una franja y la rejilla resaltaría otra. */
  const punta = useMemo(() => {
    if (medida === "mensajes") return actividad.puntaSemanal;
    let mejor: { dia: number; cubo: number } | null = null;
    let tope = 0;
    actividad.mapaPorCubos.forEach((fila, dia) =>
      fila.forEach((c, cubo) => {
        if (valor(c) > tope) {
          tope = valor(c);
          mejor = { dia, cubo };
        }
      })
    );
    return mejor;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actividad, medida]);

  const parciales = tendencias.serie.filter((p) => p.parcial);

  const diaPunta = actividad.porDiaDeLaSemana.reduce(
    (mejor, c, i) => (valor(c) > valor(actividad.porDiaDeLaSemana[mejor]) ? i : mejor),
    0
  );

  const accion = (metrica: string) => (
    <EstoNoCuadra metrica={metrica} marcada={marcadas.includes(metrica)} onMarcar={onNoCuadra} />
  );

  return (
    <>
      <Tarjeta titulo={enTexto(t("Cuándo habláis"))} accion={accion("horas")}>
        <Titular>
          {punta
            ? t("Sobre todo los {{dia}} {{franja}}", {
                dia: t(DIAS_LARGO[punta.dia]),
                franja: t(FRANJAS[punta.cubo]),
              })
            : t("Aún no hay bastante para ver un patrón")}
        </Titular>

        {/* La rejilla en cubos de cuatro horas, no las 24 barras: 168 celdas
            en un móvil salen a tres píxeles y casi todas tienen cero o un
            mensaje, así que lo que se ve es ruido. */}
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {actividad.mapaPorCubos.map((fila, d) => (
            <div key={d} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span
                style={{
                  width: 14,
                  fontFamily: "var(--font-mono)",
                  fontSize: 10.5,
                  color: "var(--slate-500)",
                }}
              >
                {DIAS[d]}
              </span>
              {fila.map((c, cubo) => {
                const n = valor(c);
                const esPunta = !!punta && punta.dia === d && punta.cubo === cubo;
                return (
                  <div
                    key={cubo}
                    title={`${t(DIAS_LARGO[d])} ${t(FRANJAS[cubo])} · ${numero(n, idioma)}`}
                    style={{
                      flex: 1,
                      height: 22,
                      borderRadius: 4,
                      /* La intensidad va con la raíz y no con el valor: una
                         franja punta con el triple de mensajes dejaría todas
                         las demás en blanco si fuera lineal, y entonces solo
                         se vería una celda. */
                      background: tinta(n, maxCubo),
                      outline: esPunta ? "1.5px solid var(--ink-900)" : "none",
                      outlineOffset: 1,
                    }}
                  />
                );
              })}
              {/* El total del día, al final de su fila: la tarjeta de «qué
                  días» repetía esto mismo en otra gráfica. */}
              <span
                style={{
                  width: 42,
                  textAlign: "right",
                  fontFamily: "var(--font-mono)",
                  fontSize: 10.5,
                  color: d === diaPunta ? "var(--ink-900)" : "var(--slate-500)",
                }}
              >
                {numero(valor(actividad.porDiaDeLaSemana[d]), idioma)}
              </span>
            </div>
          ))}
        </div>
        <div
          style={{
            display: "flex",
            gap: 6,
            paddingLeft: 20,
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "var(--slate-500)",
          }}
        >
          {FRANJAS.map((f, i) => (
            <span key={i} style={{ flex: 1, textAlign: "center" }}>
              {HORA_INICIAL[i]}
            </span>
          ))}
          <span style={{ width: 42 }} />
        </div>
        {/* El export trae la hora del teléfono que lo generó, sin huso. Decirlo
            evita que alguien lea «escribes de madrugada» siendo mediodía. */}
        <Detalle>
          {t("Son las horas del teléfono que exportó el chat, no las de donde estés ahora.")}
        </Detalle>
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
              title={
                `${nombreDeMes(p.anio, p.mes, idioma)} · ${numero(p.valor, idioma)}` +
                (p.parcial
                  ? ` · ${enTexto(
                      t("solo {{dias}} de {{total}} días en el archivo", {
                        dias: p.diasCubiertos,
                        total: p.diasDelMes,
                      })
                    )}`
                  : "")
              }
              style={{ flex: 1, minWidth: 4, display: "flex", flexDirection: "column", justifyContent: "flex-end", height: "100%" }}
            >
              <div
                style={{
                  height: `${Math.max(1, (p.valor / maxMes) * 100)}%`,
                  /* El mes a medias va rayado y no sólido: así se ve que esa
                     barra no es comparable con las de al lado sin tener que
                     leer el pie. Un export que acaba el día 15 deja el último
                     mes bajo, y sin la marca la gráfica cuenta que la
                     conversación se apagó. */
                  background:
                    p.valor === 0
                      ? "var(--paper-100)"
                      : p.parcial
                      ? "repeating-linear-gradient(135deg, #c2c7cc 0 3px, var(--paper-100) 3px 6px)"
                      : "#c2c7cc",
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
            <span>
              {nombreDeMes(tendencias.serie[0].anio, tendencias.serie[0].mes, idioma)}
              {tendencias.serie[0].parcial ? "*" : ""}
            </span>
            <span>
              {nombreDeMes(
                tendencias.serie[tendencias.serie.length - 1].anio,
                tendencias.serie[tendencias.serie.length - 1].mes,
                idioma
              )}
              {tendencias.serie[tendencias.serie.length - 1].parcial ? "*" : ""}
            </span>
          </div>
        )}
        {parciales.length > 0 && (
          <Detalle>
            {t(
              "* Meses a medias: el archivo empieza el {{desde}} y termina el {{hasta}}, así que esos dos no se pueden comparar con los demás.",
              {
                desde: analisis.desde ? fechaCorta(new Date(analisis.desde), idioma) : "",
                hasta: analisis.hasta ? fechaCorta(new Date(analisis.hasta), idioma) : "",
              }
            )}
          </Detalle>
        )}
        {tendencias.comparacion && (
          <Detalle>
            {t(
              "Media de los últimos {{meses}} meses enteros: {{reciente}}. Los {{meses}} anteriores: {{anterior}}.",
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
