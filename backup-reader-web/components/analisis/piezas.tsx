import { FC, ReactNode } from "react";
import { t } from "i18next";

/**
 * Las piezas que comparten todas las tarjetas del análisis.
 *
 * Los estilos viven en `styles/backupreader-design.css`, con el prefijo
 * `br-an-`, y no aquí dentro: con cinco vistas, una tarjeta que se ve
 * distinta se lee como si dijera algo distinto, y los estilos en línea
 * hacen que eso pase sin que nadie lo decida.
 */

/**
 * Los días de la semana, empezando en lunes. Son claves de i18n.
 *
 * En plural, porque siempre van detrás de «los»: «los lunes», «los
 * sábados». Lunes a viernes se escriben igual en singular y plural, sábado
 * y domingo no, y en singular salía «los sábado».
 */
export const DIAS = ["L", "M", "X", "J", "V", "S", "D"];
export const DIAS_LARGO = [
  "lunes", "martes", "miércoles", "jueves", "viernes", "sábados", "domingos",
];

/** Las seis franjas del día, en el orden de los cubos de `actividad`. */
export const FRANJAS = [
  "de madrugada",
  "a primera hora",
  "por la mañana",
  "a mediodía",
  "por la tarde",
  "por la noche",
];
export const HORA_INICIAL = ["0h", "4h", "8h", "12h", "16h", "20h"];

export const enTexto = (traducido: unknown): string =>
  (traducido as string | null | undefined) ?? "";

export const Tarjeta: FC<{
  titulo?: string;
  children: ReactNode;
  /** Botón de la esquina, para «Esto no cuadra». */
  accion?: ReactNode;
}> = ({ titulo, children, accion }) => (
  <section className="br-an-tarjeta">
    {(titulo || accion) && (
      <div className="br-an-cabecera">
        {titulo && <h3 className="br-an-titulo">{titulo}</h3>}
        {accion}
      </div>
    )}
    {children}
  </section>
);

export const Titular: FC<{ children: ReactNode }> = ({ children }) => (
  <p className="br-an-titular">{children}</p>
);

export const Detalle: FC<{ children: ReactNode }> = ({ children }) => (
  <p className="br-an-detalle">{children}</p>
);

/**
 * El bloque oscuro del resumen.
 *
 * Es lo primero que se ve al abrir la pestaña, así que solo lleva hechos:
 * cuántos mensajes, en cuánto tiempo y cuándo se habla. Nada de veredictos
 * ni de adjetivos. Lo que viene debajo ya compara personas; esto todavía no.
 */
export const EnNumeros: FC<{ children: ReactNode }> = ({ children }) => (
  <div className="br-an-numeros">
    <span className="br-an-numeros-label">{t("En números")}</span>
    <p className="br-an-numeros-frase">{children}</p>
  </div>
);

/* Los grises del reparto, del más fuerte al más tenue. */
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
    <div className="br-an-reparto">
      {partes.map((p, i) => (
        <div
          key={p.etiqueta}
          style={{ width: `${p.porcentaje}%`, background: COLORES[i % COLORES.length] }}
        />
      ))}
    </div>
    <div className="br-an-leyenda">
      {partes.map((p) => (
        <span key={p.etiqueta}>
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
  alto,
}) => (
  <div className="br-an-barra" style={alto ? { height: alto } : undefined}>
    <span style={{ width: `${total > 0 ? Math.max(2, (parte / total) * 100) : 0}%` }} />
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
    className="br-an-senal"
    onClick={() => onMarcar(metrica)}
    disabled={marcada}
    title={enTexto(t("Solo se guarda qué métrica y cuándo. Nada del chat."))}
  >
    {marcada ? t("Anotado") : t("Esto no cuadra")}
  </button>
);
