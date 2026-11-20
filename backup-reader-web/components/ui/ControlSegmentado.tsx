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
 *
 * LA EXCEPCIÓN: UNA OPCIÓN QUE ES UN INTERRUPTOR
 * ----------------------------------------------
 * «Análisis» en escritorio vive en esta misma barra, pero no sustituye a la
 * vista: abre un panel al lado, así que el chat sigue ahí. Marcarla como
 * elegida apagaría «Mensajes» y diría que ya no estás viendo los mensajes,
 * que es mentira. Por eso una opción puede declararse `conmutador`: va en el
 * mismo marco, se enciende y se apaga por su cuenta, y se dibuja hundida en
 * vez de elevada, para que se lea como un botón pulsado y no como la
 * pestaña en la que estás.
 */
export const ControlSegmentado: FC<{
  /** `insignia` marca una opción nueva («NUEVO») sin añadir otro elemento. */
  opciones: Array<{
    valor: string;
    etiqueta: string;
    insignia?: string;
    /** No elige vista: se enciende y se apaga sin apagar a las demás. */
    conmutador?: boolean;
    /** Solo para un conmutador: si está encendido ahora mismo. */
    encendido?: boolean;
  }>;
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
        const conmutador = !!opcion.conmutador;
        const encendido = conmutador && !!opcion.encendido;
        /* Un conmutador nunca está «elegido»: está encendido o apagado. */
        const activa = !conmutador && opcion.valor === valor;
        return (
          <button
            key={opcion.valor}
            type="button"
            role={conmutador ? "button" : "tab"}
            aria-selected={conmutador ? undefined : activa}
            aria-pressed={conmutador ? encendido : undefined}
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
              /* Elegida: elevada sobre el marco. Conmutador encendido:
                 hundido dentro de él. Dos estados que se distinguen a
                 simple vista sin leer la etiqueta. */
              background: activa
                ? "var(--surface-raised)"
                : encendido
                ? "var(--ink-900)"
                : "transparent",
              boxShadow: activa ? "var(--shadow-xs)" : "none",
              fontFamily: "var(--font-sans)",
              fontSize: 13.5,
              fontWeight: activa || encendido ? 600 : 500,
              color: encendido
                ? "var(--paper-100)"
                : activa
                ? "var(--ink-900)"
                : "var(--slate-500)",
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
                  background: encendido
                    ? "rgba(255,255,255,0.22)"
                    : activa
                    ? "var(--ink-900)"
                    : "var(--paper-200, #e9e7e2)",
                  color: encendido
                    ? "var(--paper-100)"
                    : activa
                    ? "var(--paper-100)"
                    : "var(--slate-500)",
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
