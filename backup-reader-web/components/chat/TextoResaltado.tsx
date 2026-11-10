import { FC } from "react";

import { partirPorCoincidencias } from "../../lib/busqueda/resaltar";

/**
 * Un texto con lo buscado marcado dentro.
 *
 * Antes la burbuja entera cambiaba de color cuando el mensaje coincidía. Eso
 * dice en qué mensaje está la palabra, pero no dónde: en un mensaje largo hay
 * que releerlo entero para encontrarla. Marcando el término se ve de un
 * vistazo.
 *
 * DOS INTENSIDADES, NO UNA
 * ------------------------
 * La coincidencia en la que está el usuario ahora mismo va en ocre sólido; las
 * demás, en un tono suave. Sin esa diferencia, al pulsar la flecha para saltar
 * a la siguiente no se nota adónde saltó: todo está marcado igual y el único
 * indicio sería el desplazamiento de la página.
 */
export const TextoResaltado: FC<{
  texto: string;
  consulta: string;
  /** Índice global de la coincidencia activa, o null si no hay ninguna. */
  activa?: number | null;
  /** Índice global de la primera coincidencia de ESTE texto. */
  desplazamiento?: number;
  style?: React.CSSProperties;
}> = ({ texto, consulta, activa = null, desplazamiento = 0, style }) => {
  const trozos = partirPorCoincidencias(texto, consulta);

  /* Sin coincidencias se devuelve el texto tal cual, sin envolverlo en spans:
     la gran mayoría de los mensajes no coinciden, y partirlos en nodos para
     nada encarece el pintado de una lista larga. */
  if (!trozos.some((t) => t.coincide)) {
    return <span style={style}>{texto}</span>;
  }

  return (
    <span style={style}>
      {trozos.map((trozo, i) => {
        if (!trozo.coincide) return <span key={i}>{trozo.texto}</span>;

        const esLaActiva = activa !== null && desplazamiento + trozo.indice === activa;
        return (
          <mark
            key={i}
            data-coincidencia={desplazamiento + trozo.indice}
            style={{
              /* <mark> trae de serie un amarillo de navegador que no es de la
                 paleta. Se redefine todo. */
              background: esLaActiva ? "var(--brass-400)" : "var(--brass-100)",
              color: esLaActiva ? "var(--ink-950)" : "inherit",
              borderRadius: 3,
              padding: "0 2px",
              fontWeight: esLaActiva ? 600 : 400,
            }}
          >
            {trozo.texto}
          </mark>
        );
      })}
    </span>
  );
};

export default TextoResaltado;
