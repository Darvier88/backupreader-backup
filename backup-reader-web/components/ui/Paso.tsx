import { FC, ReactNode } from "react";

/**
 * Piezas que se repiten en las pantallas de pasos del rediseño (4–9).
 *
 * Las medidas salen de los HTML del diseño: el ícono en baldosa de 56px con
 * radio 12 (4c, 5a, 5e, 7d, 8a), la barra de progreso de 3px (5a, 6a, 6b), el
 * aviso en caja con su ícono (5a, 7d, 9b) y la casilla dentro de una caja
 * (5b, 7e). Estaban dibujadas en cada pantalla del diseño y en ninguna de la
 * aplicación; juntarlas aquí evita que vuelvan a divergir.
 */

type TipoIcono = "candado" | "llave" | "sobre" | "check" | "papelera" | "aviso";

/** Dónde se pinta: sobre tinta, sobre papel en tinta, en verde suave o en arcilla. */
type Tono = "sobreTinta" | "tinta" | "suave" | "arcilla";

const trazos: Record<TipoIcono, ReactNode> = {
  candado: (
    <>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    </>
  ),
  llave: (
    <>
      <circle cx="8" cy="15" r="4" />
      <path d="M10.8 12.2L19 4M15.5 7.5l2.5 2.5M17.5 5.5l2 2" />
    </>
  ),
  sobre: (
    <>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
      <path d="M4 7l8 6 8-6" />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  papelera: <path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13M10 11v5.5M14 11v5.5" />,
  aviso: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.8v5M12 16.2v.1" />
    </>
  ),
};

export const Trazo: FC<{ tipo: TipoIcono; tam?: number; color?: string }> = ({
  tipo,
  tam = 22,
  color = "currentColor",
}) => (
  <svg width={tam} height={tam} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {trazos[tipo]}
  </svg>
);

const estilosTono: Record<Tono, React.CSSProperties> = {
  sobreTinta: { background: "var(--ink-800)", border: "1px solid var(--border-on-ink)", color: "var(--brass-300)" },
  tinta: { background: "var(--ink-900)", color: "var(--paper-50)" },
  suave: { background: "var(--brass-100)", color: "var(--brass-700)" },
  arcilla: { background: "var(--clay-100)", color: "var(--clay-600)" },
};

/** Ícono en baldosa sobre el título (4c, 5a, 5e, 6b, 7d, 8a, 9b). */
export const IconoPaso: FC<{
  tipo: TipoIcono;
  tono: Tono;
  tam?: number;
  redondo?: boolean;
  className?: string;
}> = ({ tipo, tono, tam = 56, redondo, className }) => (
  <div
    className={className}
    style={{
      width: tam,
      height: tam,
      flexShrink: 0,
      borderRadius: redondo ? "50%" : tam >= 48 ? 12 : 8,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      ...estilosTono[tono],
    }}
  >
    <Trazo tipo={tipo} tam={Math.round(tam * 0.42)} />
  </div>
);

/**
 * Barra de progreso de los tres pasos del alta (5a, 6a, 6b).
 * `continua`: una sola barra de 3px que se llena (pantallas de tinta);
 * si no, tres segmentos separados (pantallas de papel).
 */
export const BarraProgreso: FC<{ hechos: number; total?: number; oscuro?: boolean; continua?: boolean }> = ({
  hechos,
  total = 3,
  oscuro,
  continua,
}) =>
  continua ? (
    <div style={{ height: 3, flexShrink: 0, background: oscuro ? "var(--ink-800)" : "var(--slate-200)" }}>
      <div style={{ width: `${(hechos / total) * 100}%`, height: 3, background: oscuro ? "var(--brass-400)" : "var(--brass-500)" }} />
    </div>
  ) : (
    <div style={{ display: "flex", gap: 8 }} aria-hidden>
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: 3,
            borderRadius: 2,
            background: i < hechos ? "var(--brass-500)" : oscuro ? "var(--ink-700)" : "var(--slate-200)",
          }}
        />
      ))}
    </div>
  );

/** Aviso en caja con ícono (5a sobre tinta, 7d en ocre, 9b en arcilla). */
export const AvisoCaja: FC<{ tono: "sobreTinta" | "ocre" | "arcilla"; children: ReactNode }> = ({ tono, children }) => {
  const caja: React.CSSProperties =
    tono === "sobreTinta"
      ? { background: "var(--ink-800)", border: "1px solid var(--border-on-ink)", color: "var(--paper-50)" }
      : tono === "ocre"
      ? { background: "var(--ochre-100)", border: "1px solid rgba(184,132,43,0.25)", color: "var(--ink-900)" }
      : { background: "var(--clay-100)", color: "var(--ink-900)" };
  const icono = tono === "sobreTinta" ? "var(--brass-300)" : tono === "ocre" ? "#B8842B" : "var(--clay-600)";
  return (
    <div style={{ display: "flex", gap: 12, padding: "14px", borderRadius: 10, ...caja }}>
      <span style={{ flexShrink: 0, marginTop: 1 }}>
        <Trazo tipo="aviso" tam={18} color={icono} />
      </span>
      <div style={{ fontFamily: "var(--font-sans)", fontSize: 13.5, lineHeight: 1.45 }}>{children}</div>
    </div>
  );
};

/** Casilla dentro de una caja, con la marca en verde (5b, 7e). */
export const CasillaCaja: FC<{
  marcada: boolean;
  onCambio: (v: boolean) => void;
  oscuro?: boolean;
  children: ReactNode;
}> = ({ marcada, onCambio, oscuro, children }) => (
  <label
    style={{
      display: "flex",
      gap: 12,
      alignItems: "flex-start",
      padding: 14,
      borderRadius: 10,
      /* `oscuro` sigue las variables de .br-paso: tinta en móvil y papel en
         la columna del formulario de escritorio (5b / 7e). */
      border: `1px solid ${oscuro ? "var(--paso-borde, var(--border-on-ink))" : "var(--border)"}`,
      background: oscuro ? "var(--paso-caja, transparent)" : "var(--surface-raised)",
      cursor: "pointer",
    }}
  >
    <input
      type="checkbox"
      checked={marcada}
      onChange={(e) => onCambio(e.target.checked)}
      className="br-casilla"
    />
    <span style={{ fontFamily: "var(--font-sans)", fontSize: 14, lineHeight: 1.45, color: oscuro ? "var(--paso-texto, var(--paper-50))" : "var(--ink-900)" }}>
      {children}
    </span>
  </label>
);

/** Flecha de «atrás» de 44px (4b, 5b, 5d, 5e). */
export const BotonAtras: FC<{ onClick: () => void; etiqueta: string; oscuro?: boolean }> = ({ onClick, etiqueta, oscuro }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={etiqueta}
    style={{
      width: 44,
      height: 44,
      marginLeft: -12,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      background: "transparent",
      border: "none",
      cursor: "pointer",
      color: oscuro ? "var(--paper-50)" : "var(--ink-900)",
    }}
  >
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M15 5l-7 7 7 7" />
    </svg>
  </button>
);
