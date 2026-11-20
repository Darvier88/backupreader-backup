import { FC } from "react";

/**
 * Un control segmentado: dos o más opciones que comparten un marco y de las
 * que siempre hay exactamente una activa.
 *
 * Sustituye a los dos botones sueltos de Mensajes / Media. Dos botones
 * separados con relleno oscuro se leen como dos acciones —cosas que uno puede
 * pulsar para que pasen—, cuando en realidad son dos vistas de lo mismo y
 * elegir una apaga la otra. Al compartir marco, con el fondo moviéndose
 * dentro, eso se ve sin tener que probarlo.
 */
export const ControlSegmentado: FC<{
  /** `insignia` marca una opción nueva («NUEVO») sin añadir otro elemento. */
  opciones: Array<{ valor: string; etiqueta: string; insignia?: string }>;
  valor: string;
  onCambio: (valor: string) => void;
  /** Ocupa todo el ancho disponible. En móvil suele interesar. */
  completo?: boolean;
}> = ({ opciones, valor, onCambio, completo }) => {
  return (
    <div
      role="tablist"
      style={{
        display: "inline-flex",
        width: completo ? "100%" : undefined,
        /* Si las etiquetas no caben, se desliza en vez de cortarse. En el
           panel de un grupo son cuatro y la primera es «Quién habla»: sin
           esto, «Ajustes» se quedaba partido contra el borde y parecía que
           no existía. */
        maxWidth: "100%",
        overflowX: "auto",
        scrollbarWidth: "none",
        padding: 3,
        gap: 2,
        borderRadius: 10,
        border: "1px solid var(--border)",
        background: "var(--paper-100)",
      }}
    >
      {opciones.map((opcion) => {
        const activa = opcion.valor === valor;
        return (
          <button
            key={opcion.valor}
            type="button"
            role="tab"
            aria-selected={activa}
            onClick={() => onCambio(opcion.valor)}
            style={{
              flex: completo ? 1 : undefined,
              minHeight: 38,
              /* 10 y no 16: con cuatro pestañas en un panel de 360 px, seis
                 píxeles por lado a cada una son los que deciden si cabe. */
              padding: completo ? "0 10px" : "0 16px",
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
              background: activa ? "var(--surface-raised)" : "transparent",
              boxShadow: activa ? "var(--shadow-xs)" : "none",
              fontFamily: "var(--font-sans)",
              fontSize: 13.5,
              fontWeight: activa ? 600 : 500,
              color: activa ? "var(--ink-900)" : "var(--slate-500)",
              whiteSpace: "nowrap",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            {opcion.etiqueta}
            {opcion.insignia && (
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 9,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  lineHeight: 1,
                  padding: "3px 5px",
                  borderRadius: 4,
                  background: activa ? "var(--ink-900)" : "var(--paper-200, #e9e7e2)",
                  color: activa ? "var(--paper-100)" : "var(--slate-500)",
                }}
              >
                {opcion.insignia}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default ControlSegmentado;
