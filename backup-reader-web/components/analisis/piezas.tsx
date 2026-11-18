import { FC, ReactNode } from "react";
import { t } from "i18next";

/**
 * Las piezas que comparten todas las tarjetas del análisis.
 *
 * Están aquí y no repetidas en cada vista para que el tono y el espaciado
 * sean los mismos en las cinco pestañas: una tarjeta que se ve distinta se
 * lee como si dijera algo distinto.
 */

export const enTexto = (traducido: unknown): string =>
  (traducido as string | null | undefined) ?? "";

export const Tarjeta: FC<{
  titulo?: string;
  children: ReactNode;
  /** Botón de la esquina, para «Esto no cuadra». */
  accion?: ReactNode;
}> = ({ titulo, children, accion }) => (
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
    {(titulo || accion) && (
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {titulo && (
          <h3
            style={{
              margin: 0,
              flex: 1,
              minWidth: 0,
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
        )}
        {accion}
      </div>
    )}
    {children}
  </section>
);

export const Titular: FC<{ children: ReactNode }> = ({ children }) => (
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

export const Detalle: FC<{ children: ReactNode }> = ({ children }) => (
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

const COLORES = ["var(--ink-900)", "#9aa0a6", "#c2c7cc", "#dcdfe3", "#eceef0"];

/**
 * La barra del reparto.
 *
 * Deja ver que 52/48 no es lo mismo que 80/20 sin leer un número, que es
 * justo lo que una cifra sola no transmite.
 */
export const Reparto: FC<{ partes: Array<{ etiqueta: string; porcentaje: number }> }> = ({
  partes,
}) => (
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
          style={{ width: `${p.porcentaje}%`, background: COLORES[i % COLORES.length] }}
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

/** Una barra horizontal suelta, para las listas (emojis, palabras, horas). */
export const Barra: FC<{ parte: number; total: number; alto?: number }> = ({
  parte,
  total,
  alto = 6,
}) => (
  <div
    style={{
      height: alto,
      borderRadius: 999,
      background: "var(--paper-100)",
      overflow: "hidden",
      minWidth: 40,
    }}
  >
    <div
      style={{
        width: `${total > 0 ? Math.max(2, (parte / total) * 100) : 0}%`,
        height: "100%",
        background: "var(--ink-900)",
      }}
    />
  </div>
);

/** Lo que se enseña cuando una métrica no tiene datos suficientes. */
export const Insuficiente: FC<{ children: ReactNode }> = ({ children }) => (
  <Detalle>{children}</Detalle>
);

/**
 * «Esto no cuadra».
 *
 * Una cifra sobre la propia conversación puede estar mal por cosas que desde
 * fuera no se ven: un apodo que cambió, un chat exportado dos veces, un
 * formato de fecha raro. Sin un sitio donde decirlo, la única reacción
 * posible es dejar de fiarse de todo el panel en silencio.
 *
 * Solo registra QUÉ métrica y CUÁNDO. Ni el texto del chat, ni los nombres,
 * ni las cifras: nada de eso hace falta para saber qué métrica se tuerce.
 */
export const EstoNoCuadra: FC<{
  metrica: string;
  marcada: boolean;
  onMarcar: (metrica: string) => void;
}> = ({ metrica, marcada, onMarcar }) => (
  <button
    type="button"
    onClick={() => onMarcar(metrica)}
    disabled={marcada}
    title={enTexto(t("Solo se guarda qué métrica y cuándo. Nada del chat."))}
    style={{
      border: "1px solid var(--border)",
      background: marcada ? "var(--paper-100)" : "transparent",
      borderRadius: 999,
      padding: "4px 10px",
      cursor: marcada ? "default" : "pointer",
      fontFamily: "var(--font-sans)",
      fontSize: 11,
      color: "var(--slate-500)",
      whiteSpace: "nowrap",
    }}
  >
    {marcada ? t("Anotado") : t("Esto no cuadra")}
  </button>
);
